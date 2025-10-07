use crate::{error::ServerErr, server::ServerId, snapshot::Update, Sender};
use axum::{
    extract::{Query, State},
    response::{sse::Event, IntoResponse},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{query, query_scalar, SqlitePool};
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

pub type ChannelId = i32;

pub const CHANNEL_NAME_MAX_LEN: usize = 32;
pub const CREATE_CHANNEL_PATH: &str = "/create-channel";

#[derive(Serialize, Deserialize, TS, ToSchema, Clone, Debug)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub struct Channel {
    pub server_id: ServerId,
    pub id: ChannelId,
    pub name: String,
}

impl Channel {
    pub async fn insert(
        pool: &SqlitePool,
        server_id: ServerId,
        name: String,
    ) -> Result<Self, ServerErr> {
        let len = name.len();
        if len > CHANNEL_NAME_MAX_LEN {
            Err(ServerErr::ChannelNameTooLong(len))
        } else {
            let id = query!(
                r#"
                INSERT INTO channels (server_id, name)
                VALUES (?1, ?2)
                RETURNING id AS "id!: i32";
                "#,
                server_id,
                name
            )
            .fetch_one(pool)
            .await?
            .id;
            Ok(Self {
                server_id,
                id,
                name,
            })
        }
    }
}

#[derive(Serialize, Deserialize, TS, IntoParams, Clone)]
pub struct CreateChannelParams {
    #[param(example = "My Channel Name", required = true)]
    name: String,
    #[param(required = true)]
    server_id: ServerId,
}

#[utoipa::path(
    post,
    path = CREATE_CHANNEL_PATH,
    params(CreateChannelParams),
    responses(
        (status = 200, description = "Create a new channel", body = Channel),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn create_channel(
    State(pool): State<SqlitePool>,
    State(send): State<Sender>,
    Query(query): Query<CreateChannelParams>,
) -> Result<impl IntoResponse, ServerErr> {
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
    let channel = Channel::insert(&pool, query.server_id, query.name).await?;
    let event = Event::default().json_data(Update::Channel(channel.clone()))?;
    send.send(event)?;
    Ok(Json(channel))
}
