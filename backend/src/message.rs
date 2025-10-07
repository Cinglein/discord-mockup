use crate::{
    channel::ChannelId, error::ServerErr, server::ServerId, snapshot::Update, user::UserId, Sender,
};
use axum::{
    extract::{Query, State},
    response::{sse::Event, IntoResponse},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{query, query_scalar, SqlitePool};
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

pub type MessageId = i64;

pub const MESSAGE_MAX_LEN: usize = 512;
pub const CREATE_MESSAGE_PATH: &str = "/create-message";

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
        (status = 200, description = "Create a new message", body = Message),
        (status = 500, description = "Internal message error", body = String)
    )
)]
pub async fn create_message(
    State(pool): State<SqlitePool>,
    State(send): State<Sender>,
    Query(query): Query<CreateMessageParams>,
) -> Result<impl IntoResponse, ServerErr> {
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
    let event = Event::default().json_data(Update::Message(message.clone()))?;
    send.send(event)?;
    Ok(Json(message))
}
