use crate::{channel::*, error::ServerErr, message::*, server::*, typing::*, user::*, Sender};
use axum::{
    extract::State,
    response::{sse::Event, IntoResponse, Sse},
    Json,
};
use chrono::{DateTime, Utc};
use futures_util::Stream;
use serde::{Deserialize, Serialize};
use sqlx::{query_as, SqlitePool};
use std::collections::{HashMap, HashSet};
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use ts_rs::TS;
use utoipa::ToSchema;

pub const GET_UPDATES_PATH: &str = "/updates";
pub const SNAPSHOT_PATH: &str = "/snapshot";
pub const SNAPSHOT_DEPTH: i64 = 128;

#[derive(Serialize, Deserialize, Clone, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub enum Update {
    User(User),
    Server(Server),
    Channel(Channel),
    Message(Message),
    Typing(Typing),
    VoiceJoin { user_id: UserId, channel_id: i32 },
    VoiceLeave { user_id: UserId, channel_id: i32 },
}

#[utoipa::path(
    get,
    path = GET_UPDATES_PATH,
    params(),
    responses(
        (status = 200, description = "Subscribe to SSE updates", body = ()),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn get_updates(
    State(send): State<Sender>,
) -> Sse<impl Stream<Item = Result<Event, BroadcastStreamRecvError>>> {
    tracing::info!("New SSE client connected to /updates");
    let stream: BroadcastStream<_> = send.subscribe().into();
    Sse::new(stream).keep_alive(Default::default())
}

#[derive(Serialize, Deserialize, Clone, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub struct Snapshot {
    users: HashMap<UserId, User>,
    channels: HashMap<ServerId, Vec<Channel>>,
    servers: HashMap<ServerId, Server>,
    messages: HashMap<ServerId, HashMap<ChannelId, Vec<Message>>>,
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
        let servers: HashSet<ServerId> = channels.iter().map(|channel| channel.server_id).collect();
        let channels = servers
            .into_iter()
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
    ) -> Result<HashMap<ServerId, HashMap<ChannelId, Vec<Message>>>, ServerErr> {
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
        let servers: HashSet<ServerId> = messages.iter().map(|msg| msg.server_id).collect();
        let channels: HashMap<ServerId, Vec<ChannelId>> = servers
            .into_iter()
            .map(|server_id| {
                (
                    server_id,
                    messages
                        .iter()
                        .filter_map(|msg| (msg.server_id == server_id).then_some(msg.channel_id))
                        .collect(),
                )
            })
            .collect();
        let messages = channels
            .into_iter()
            .map(|(server_id, channels)| {
                (
                    server_id,
                    channels
                        .into_iter()
                        .map(|channel_id| {
                            (
                                channel_id,
                                messages
                                    .iter()
                                    .filter(|msg| msg.channel_id == channel_id)
                                    .rev()
                                    .cloned()
                                    .collect(),
                            )
                        })
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
