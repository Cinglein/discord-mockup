use crate::{error::ServerErr, SendServer, MAX_BROADCAST};
use axum::{
    extract::{Query, State},
    response::{sse::Event, Sse},
};
use futures_util::Stream;
use serde::{Deserialize, Serialize};
use sqlx::{query, SqlitePool};
use tokio::sync::broadcast;
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

pub type ServerId = i32;

pub const SERVER_NAME_MAX_LEN: usize = 32;
pub const CREATE_SERVER_PATH: &str = "/create-server";
pub const CREATE_SERVER_UPDATES_PATH: &str = "/create-server-updates";

#[derive(Serialize, Deserialize, Clone, Debug, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub struct Server {
    pub id: ServerId,
    pub name: String,
}

impl Server {
    pub fn init() -> SendServer {
        let (send, _recv) = broadcast::channel(MAX_BROADCAST);
        SendServer(send)
    }
    pub async fn insert(pool: &SqlitePool, name: String) -> Result<Self, ServerErr> {
        let len = name.len();
        if len > SERVER_NAME_MAX_LEN {
            Err(ServerErr::ServerNameTooLong(len))
        } else {
            let id = query!(
                r#"
                INSERT INTO servers (name)
                VALUES ($1)
                RETURNING id AS "id!: i32"
                "#,
                name
            )
            .fetch_one(pool)
            .await?
            .id;
            Ok(Self { id, name })
        }
    }
}

#[derive(Serialize, Deserialize, TS, IntoParams, Clone)]
pub struct CreateServerParams {
    #[param(example = "My Server Name", required = true)]
    name: String,
}

#[utoipa::path(
    post,
    path = CREATE_SERVER_PATH,
    params(CreateServerParams),
    responses(
        (status = 200, description = "Create a new server", body = ()),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn create_server(
    State(pool): State<SqlitePool>,
    State(SendServer(send)): State<SendServer>,
    Query(query): Query<CreateServerParams>,
) -> Result<(), ServerErr> {
    let server = Server::insert(&pool, query.name).await?;
    let event = Event::default().json_data(server)?;
    send.send(event)?;
    Ok(())
}

#[utoipa::path(
    get,
    path = CREATE_SERVER_UPDATES_PATH,
    params(),
    responses(
        (status = 200, description = "Subscribe to server SSE updates", body = ()),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn create_server_updates(
    State(SendServer(send)): State<SendServer>,
) -> Sse<impl Stream<Item = Result<Event, BroadcastStreamRecvError>>> {
    let stream: BroadcastStream<_> = send.subscribe().into();
    Sse::new(stream).keep_alive(Default::default())
}
