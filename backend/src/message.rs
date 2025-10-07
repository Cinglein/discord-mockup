use crate::{
    channel::ChannelId, error::ServerErr, server::ServerId, user::UserId, SendMessage,
    MAX_BROADCAST,
};
use axum::{
    extract::{Query, State},
    response::{sse::Event, Sse},
};
use chrono::{DateTime, Utc};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use sqlx::{query, query_scalar, SqlitePool};
use tokio::sync::broadcast;
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

pub type MessageId = i64;

pub const MESSAGE_MAX_LEN: usize = 512;
pub const CREATE_MESSAGE_PATH: &str = "/create-message";
pub const CREATE_MESSAGE_UPDATES_PATH: &str = "/create-message-updates";

#[derive(Serialize, Deserialize, Clone, Debug, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub struct Message {
    pub user_id: UserId,
    pub channel_id: ChannelId,
    pub server_id: ServerId,
    pub ts: DateTime<Utc>,
    pub id: MessageId,
    pub text: String,
}

impl Message {
    pub fn init() -> SendMessage {
        let (send, _recv) = broadcast::channel(MAX_BROADCAST);
        SendMessage(send)
    }
    pub async fn insert(
        pool: &SqlitePool,
        user_id: UserId,
        channel_id: ChannelId,
        server_id: ServerId,
        text: String,
    ) -> Result<Self, ServerErr> {
        let len = text.len();
        if len > MESSAGE_MAX_LEN {
            Err(ServerErr::MessageTooLong(len))
        } else {
            let ts = Utc::now();
            let id = query!(
                r#"
                INSERT INTO messages (user_id, channel_id, server_id, text, ts)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id;
                "#,
                user_id,
                channel_id,
                server_id,
                text,
                ts
            )
            .fetch_one(pool)
            .await?
            .id;
            Ok(Self {
                user_id,
                channel_id,
                server_id,
                ts,
                id,
                text,
            })
        }
    }
}

#[derive(Serialize, Deserialize, TS, IntoParams, Clone)]
pub struct CreateMessageParams {
    #[param(example = "Hello, world!", required = true)]
    text: String,
    #[param(required = true)]
    user_id: UserId,
    #[param(required = true)]
    channel_id: ChannelId,
    #[param(required = true)]
    server_id: ServerId,
}

#[utoipa::path(
    post,
    path = CREATE_MESSAGE_PATH,
    params(CreateMessageParams),
    responses(
        (status = 200, description = "Create a new message", body = ()),
        (status = 500, description = "Internal message error", body = String)
    )
)]
pub async fn create_message(
    State(pool): State<SqlitePool>,
    State(SendMessage(send)): State<SendMessage>,
    Query(query): Query<CreateMessageParams>,
) -> Result<(), ServerErr> {
    let user_id_exists = 1
        == query_scalar!(
            r#"SELECT EXISTS(SELECT 1 FROM users WHERE id = ?1);"#,
            query.user_id
        )
        .fetch_one(&pool)
        .await?;
    if !user_id_exists {
        return Err(ServerErr::NoUserId(query.user_id));
    }
    let channel_id_exists = 1
        == query_scalar!(
            r#"SELECT EXISTS(SELECT 1 FROM channels WHERE id = ?1);"#,
            query.channel_id
        )
        .fetch_one(&pool)
        .await?;
    if !channel_id_exists {
        return Err(ServerErr::NoChannelId(query.channel_id));
    }
    let server_id_exists = 1
        == query_scalar!(
            r#"SELECT EXISTS(SELECT 1 FROM servers WHERE id = ?1);"#,
            query.server_id
        )
        .fetch_one(&pool)
        .await?;
    if !server_id_exists {
        return Err(ServerErr::NoServerId(query.server_id));
    }
    let message = Message::insert(
        &pool,
        query.user_id,
        query.channel_id,
        query.server_id,
        query.text,
    )
    .await?;
    let event = Event::default().json_data(message)?;
    send.send(event)?;
    Ok(())
}

#[utoipa::path(
    get,
    path = CREATE_MESSAGE_UPDATES_PATH,
    params(),
    responses(
        (status = 200, description = "Subscribe to message SSE updates", body = ()),
        (status = 500, description = "Internal message error", body = String)
    )
)]
pub async fn create_message_updates(
    State(SendMessage(send)): State<SendMessage>,
) -> Sse<impl Stream<Item = Result<Event, BroadcastStreamRecvError>>> {
    let stream: BroadcastStream<_> = send.subscribe().into();
    Sse::new(stream).keep_alive(Default::default())
}
