use crate::{error::ServerErr, SendUser, MAX_BROADCAST};
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

pub type UserId = i32;

pub const USERNAME_MAX_LEN: usize = 32;
pub const CREATE_USER_PATH: &str = "/create-user";
pub const CREATE_USER_UPDATES_PATH: &str = "/create-user-updates";

#[derive(Serialize, Deserialize, Clone, Debug, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub struct User {
    pub id: UserId,
    pub name: String,
}

impl User {
    pub fn init() -> SendUser {
        let (send, _recv) = broadcast::channel(MAX_BROADCAST);
        SendUser(send)
    }
    pub async fn insert(pool: &SqlitePool, name: String) -> Result<Self, ServerErr> {
        let len = name.len();
        if len > USERNAME_MAX_LEN {
            Err(ServerErr::UsernameTooLong(len))
        } else {
            let id = query!(
                r#"
                INSERT INTO users (name)
                VALUES (?1)
                RETURNING id AS "id!: i32";
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
pub struct CreateUserParams {
    #[param(example = "My User Name", required = true)]
    name: String,
}

#[utoipa::path(
    post,
    path = CREATE_USER_PATH,
    params(CreateUserParams),
    responses(
        (status = 200, description = "Create a new user", body = ()),
        (status = 500, description = "Internal user error", body = String)
    )
)]
pub async fn create_user(
    State(pool): State<SqlitePool>,
    State(SendUser(send)): State<SendUser>,
    Query(query): Query<CreateUserParams>,
) -> Result<(), ServerErr> {
    let user = User::insert(&pool, query.name).await?;
    let event = Event::default().json_data(user)?;
    send.send(event)?;
    Ok(())
}

#[utoipa::path(
    get,
    path = CREATE_USER_UPDATES_PATH,
    params(),
    responses(
        (status = 200, description = "Subscribe to user SSE updates", body = ()),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn create_user_updates(
    State(SendUser(send)): State<SendUser>,
) -> Sse<impl Stream<Item = Result<Event, BroadcastStreamRecvError>>> {
    let stream: BroadcastStream<_> = send.subscribe().into();
    Sse::new(stream).keep_alive(Default::default())
}
