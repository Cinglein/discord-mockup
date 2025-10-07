use axum::{extract::FromRef, response::sse::Event, routing::get, Router};
use sqlx::{migrate, migrate::MigrateDatabase, Sqlite, SqlitePool};
use tokio::sync::broadcast;
use tower_http::{
    compression::CompressionLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use error::ServerErr;

use channel::*;
use message::*;
use server::*;
use snapshot::*;
use user::*;

pub mod channel;
pub mod error;
pub mod message;
pub mod server;
pub mod snapshot;
pub mod user;

pub const MAX_BROADCAST: usize = 1000;

pub type Sender = broadcast::Sender<Event>;

#[derive(Clone, Debug)]
pub struct SendUser(pub Sender);
#[derive(Clone, Debug)]
pub struct SendServer(pub Sender);
#[derive(Clone, Debug)]
pub struct SendChannel(pub Sender);
#[derive(Clone, Debug)]
pub struct SendMessage(pub Sender);

#[derive(Clone, FromRef)]
struct AppState {
    pool: SqlitePool,
    create_user: SendUser,
    create_server: SendServer,
    create_channel: SendChannel,
    create_message: SendMessage,
}

impl AppState {
    fn new(pool: SqlitePool) -> Self {
        let create_user = User::init();
        let create_server = Server::init();
        let create_channel = Channel::init();
        let create_message = Message::init();
        Self {
            pool,
            create_user,
            create_server,
            create_channel,
            create_message,
        }
    }
}

#[derive(OpenApi)]
#[openapi(paths(
    create_user,
    create_server,
    create_channel,
    create_message,
    create_user_updates,
    create_server_updates,
    create_channel_updates,
    create_message_updates
))]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<(), ServerErr> {
    let dir = "frontend/out";
    let static_service =
        ServeDir::new(dir).not_found_service(ServeFile::new(format!("{dir}/404.html")));

    Sqlite::create_database("sqlite::memory:").await?;
    let pool = SqlitePool::connect("sqlite::memory:").await?;
    migrate!("../migrations").run(&pool).await?;

    let state = AppState::new(pool);

    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route(SNAPSHOT_PATH, get(get_snapshot))
        .route(CREATE_USER_PATH, get(create_user))
        .route(CREATE_SERVER_PATH, get(create_server))
        .route(CREATE_CHANNEL_PATH, get(create_channel))
        .route(CREATE_MESSAGE_PATH, get(create_message))
        .route(CREATE_USER_UPDATES_PATH, get(create_user_updates))
        .route(CREATE_SERVER_UPDATES_PATH, get(create_server_updates))
        .route(CREATE_CHANNEL_UPDATES_PATH, get(create_channel_updates))
        .route(CREATE_MESSAGE_UPDATES_PATH, get(create_message_updates))
        .fallback_service(static_service)
        .with_state(state)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
    Ok(())
}
