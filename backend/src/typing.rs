use crate::{error::ServerErr, snapshot::Update, user::UserId, Sender};
use axum::{
    extract::{Query, State},
    response::{sse::Event, IntoResponse},
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

pub const TYPING_PATH: &str = "/typing";

#[derive(Serialize, Deserialize, Clone, Debug, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub enum Typing {
    Start(UserId),
    Stop(UserId),
}

#[derive(Serialize, Deserialize, TS, IntoParams, Clone)]
pub struct TypingParams {
    #[param(required = true)]
    typing: bool,
    user_id: i32,
}

#[utoipa::path(
    post,
    path = TYPING_PATH,
    params(TypingParams),
    responses(
        (status = 200, description = "Typing indicator", body = ()),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn typing(
    State(send): State<Sender>,
    Query(query): Query<TypingParams>,
) -> Result<impl IntoResponse, ServerErr> {
    let typing = if query.typing {
        Typing::Start(query.user_id)
    } else {
        Typing::Stop(query.user_id)
    };
    let event = Event::default().json_data(Update::Typing(typing))?;
    if let Err(err) = send.send(event) {
        tracing::error!("Error sending event: {err:?}");
    }
    Ok(())
}
