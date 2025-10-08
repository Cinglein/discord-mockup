use crate::{channel::Channel, error::ServerErr, snapshot::Update, Sender};
use axum::{
    extract::{Query, State},
    response::{sse::Event, IntoResponse},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{query, SqlitePool};
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

pub type ServerId = i32;

pub const SERVER_NAME_MAX_LEN: usize = 32;
pub const CREATE_SERVER_PATH: &str = "/create-server";

#[derive(Serialize, Deserialize, Clone, Debug, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub struct Server {
    pub id: ServerId,
    pub name: String,
}

impl Server {
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
        (status = 200, description = "Create a new server", body = (Server, Channel)),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn create_server(
    State(pool): State<SqlitePool>,
    State(send): State<Sender>,
    Query(query): Query<CreateServerParams>,
) -> Result<impl IntoResponse, ServerErr> {
    let server = Server::insert(&pool, query.name).await?;
    let channel = Channel::insert(&pool, server.id, "Home".to_string()).await?;
    let event = Event::default().json_data(Update::Server(server.clone()))?;
    if let Err(err) = send.send(event) {
        tracing::error!("Error sending event: {err:?}");
    }
    let event = Event::default().json_data(Update::Channel(channel.clone()))?;
    if let Err(err) = send.send(event) {
        tracing::error!("Error sending event: {err:?}");
    }
    Ok(Json((server, channel)))
}
