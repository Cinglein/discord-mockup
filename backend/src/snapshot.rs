use crate::{channel::*, error::ServerErr, message::*, server::*, user::*};
use axum::{extract::State, response::IntoResponse, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{query_as, SqlitePool};
use std::collections::HashMap;
use ts_rs::TS;
use utoipa::ToSchema;

pub const SNAPSHOT_PATH: &str = "/snapshot";
pub const SNAPSHOT_DEPTH: i64 = 128;

#[derive(Serialize, Deserialize, Clone, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub struct Snapshot {
    users: HashMap<UserId, User>,
    channels: HashMap<ServerId, Vec<Channel>>,
    servers: HashMap<ServerId, Server>,
    messages: HashMap<(ServerId, ChannelId), Vec<Message>>,
}

impl Snapshot {
    pub async fn new(pool: &SqlitePool) -> Result<Self, ServerErr> {
        let (users, servers, channels, messages) = tokio::join!(
            Self::get_users(pool),
            Self::get_servers(pool),
            Self::get_channels(pool),
            Self::get_messages(pool)
        );
        Ok(Self {
            users: users?,
            channels: channels?,
            servers: servers?,
            messages: messages?,
        })
    }
    pub async fn get_users(pool: &SqlitePool) -> Result<HashMap<UserId, User>, ServerErr> {
        let users = query_as!(
            User,
            r#"SELECT id AS "id!: i32", name FROM users LIMIT ?1"#,
            SNAPSHOT_DEPTH
        )
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|user| (user.id, user))
        .collect();
        Ok(users)
    }
    pub async fn get_servers(pool: &SqlitePool) -> Result<HashMap<ServerId, Server>, ServerErr> {
        let servers = query_as!(
            Server,
            r#"SELECT id AS "id!: i32", name FROM servers LIMIT ?1"#,
            SNAPSHOT_DEPTH
        )
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|server| (server.id, server))
        .collect();
        Ok(servers)
    }
    pub async fn get_channels(
        pool: &SqlitePool,
    ) -> Result<HashMap<ServerId, Vec<Channel>>, ServerErr> {
        let channels = query_as!(
            Channel,
            r#"SELECT server_id AS "server_id!: i32", id AS "id!: i32", name FROM channels LIMIT ?1"#,
            SNAPSHOT_DEPTH
        )
        .fetch_all(pool)
        .await?;
        let servers = channels.iter().map(|channel| channel.server_id);
        let channels = servers
            .map(|server_id| {
                (
                    server_id,
                    channels
                        .iter()
                        .filter(|channel| channel.server_id == server_id)
                        .cloned()
                        .collect(),
                )
            })
            .collect();
        Ok(channels)
    }
    pub async fn get_messages(
        pool: &SqlitePool,
    ) -> Result<HashMap<(ServerId, ChannelId), Vec<Message>>, ServerErr> {
        let messages = query_as!(
            Message,
            r#"
            SELECT 
                user_id AS "user_id!: i32", 
                channel_id AS "channel_id!: i32", 
                server_id AS "server_id!: i32", 
                ts AS "ts!: DateTime<Utc>",
                id,
                text 
            FROM messages 
            ORDER BY ts DESC 
            LIMIT ?1;
            "#,
            SNAPSHOT_DEPTH
        )
        .fetch_all(pool)
        .await?;
        let keys = messages.iter().map(|msg| (msg.server_id, msg.channel_id));
        let messages = keys
            .map(|k| {
                (
                    k,
                    messages
                        .iter()
                        .filter(|msg| msg.server_id == k.0 && msg.channel_id == k.1)
                        .rev()
                        .cloned()
                        .collect(),
                )
            })
            .collect();
        Ok(messages)
    }
}

#[utoipa::path(
    get,
    path = SNAPSHOT_PATH,
    params(),
    responses(
        (status = 200, description = "Get a snapshot of users, servers, channels, and messages", body = Snapshot),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn get_snapshot(State(pool): State<SqlitePool>) -> Result<impl IntoResponse, ServerErr> {
    let snapshot = Snapshot::new(&pool).await?;
    Ok(Json(snapshot))
}
