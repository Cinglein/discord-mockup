use crate::{channel::*, message::*, server::*, user::*};
use axum::{
    response::{sse::Event, IntoResponse, Response},
    Error as AxumError, Json,
};
use hyper::StatusCode;
use sqlx::{migrate::MigrateError, Error as SqlxError};
use thiserror::Error;
use tokio::sync::broadcast::error::SendError;

#[derive(Error, Debug)]
pub enum ServerErr {
    #[error("Error creating message stream")]
    MessageStreamErr(#[from] AxumError),
    #[error("Error setting up sql server")]
    SqlxErr(#[from] SqlxError),
    #[error("Error migrating sql")]
    SqlxMigrateErr(#[from] MigrateError),
    #[error("Username is too long: {0}/{USERNAME_MAX_LEN} bytes")]
    UsernameTooLong(usize),
    #[error("Message text is too long: {0}/{MESSAGE_MAX_LEN} bytes")]
    MessageTooLong(usize),
    #[error("Channel name is too long: {0}/{CHANNEL_NAME_MAX_LEN} bytes")]
    ChannelNameTooLong(usize),
    #[error("Server name is too long: {0}/{SERVER_NAME_MAX_LEN} bytes")]
    ServerNameTooLong(usize),
    #[error("Server ID {0} does not exist")]
    NoServerId(ServerId),
    #[error("Channel ID {0} does not exist")]
    NoChannelId(ChannelId),
    #[error("User ID {0} does not exist")]
    NoUserId(UserId),
    #[error("Message ID {0} does not exist")]
    NoMessageId(MessageId),
    #[error("Error sending SSE event: {0}")]
    SendErr(#[from] SendError<Event>),
    #[error("Bad request: {0}")]
    BadRequest(String),
}

impl IntoResponse for ServerErr {
    fn into_response(self) -> Response {
        let status_code = match self {
            Self::NoServerId(_) => StatusCode::BAD_REQUEST,
            Self::NoUserId(_) => StatusCode::BAD_REQUEST,
            Self::NoChannelId(_) => StatusCode::BAD_REQUEST,
            Self::NoMessageId(_) => StatusCode::BAD_REQUEST,
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status_code, Json(self.to_string())).into_response()
    }
}
