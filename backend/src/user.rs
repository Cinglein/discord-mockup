use crate::{error::ServerErr, snapshot::Update, Sender};
use axum::{
    extract::{Query, State},
    response::{sse::Event, IntoResponse},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{query, SqlitePool};
use ts_rs::TS;
use utoipa::{IntoParams, ToSchema};

pub type UserId = i32;

pub const USERNAME_MAX_LEN: usize = 32;
pub const CREATE_USER_PATH: &str = "/create-user";

#[derive(Serialize, Deserialize, Clone, Debug, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
pub struct User {
    pub id: UserId,
    pub name: String,
}

impl User {
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
        (status = 200, description = "Create a new user", body = User),
        (status = 500, description = "Internal user error", body = String)
    )
)]
pub async fn create_user(
    State(pool): State<SqlitePool>,
    State(send): State<Sender>,
    Query(query): Query<CreateUserParams>,
) -> Result<impl IntoResponse, ServerErr> {
    let user = User::insert(&pool, query.name).await?;
    let event = Event::default().json_data(Update::User(user.clone()))?;
    send.send(event)?;
    Ok(Json(user))
}
