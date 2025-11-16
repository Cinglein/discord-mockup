use axum::{
    extract::FromRef,
    response::sse::Event,
    routing::{get, post},
    Router,
};
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
use typing::*;
use user::*;
use voice_signal::*;

pub mod channel;
pub mod error;
pub mod message;
pub mod server;
pub mod snapshot;
pub mod typing;
pub mod user;
pub mod voice_signal;

const MAX_BROADCAST: usize = 1000;

pub type Sender = broadcast::Sender<Event>;

#[derive(Clone, FromRef)]
struct AppState {
    pool: SqlitePool,
    send_update: Sender,
    send_voice: VoiceSender,
    voice_state: VoiceState,
}

impl AppState {
    fn new(pool: SqlitePool) -> Self {
        let (send_update, _recv) = broadcast::channel(MAX_BROADCAST);
        let (send_voice, _recv) = broadcast::channel(MAX_BROADCAST);
        Self {
            pool,
            send_update,
            send_voice,
            voice_state: VoiceState::default(),
        }
    }
}

#[derive(OpenApi)]
#[openapi(paths(
    create_user,
    create_server,
    create_channel,
    create_message,
    typing,
    get_snapshot,
    get_updates,
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

    let server = Server::insert(&pool, "My First Server".to_string()).await?;
    let _channel = Channel::insert(&pool, server.id, "Home".to_string()).await?;

    let state = AppState::new(pool);

    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route(CREATE_USER_PATH, post(create_user))
        .route(CREATE_SERVER_PATH, post(create_server))
        .route(CREATE_CHANNEL_PATH, post(create_channel))
        .route(CREATE_MESSAGE_PATH, post(create_message))
        .route(TYPING_PATH, post(typing))
        .route(SNAPSHOT_PATH, get(get_snapshot))
        .route(GET_UPDATES_PATH, get(get_updates))
        .route(VOICE_WS_PATH, get(voice_ws))
        .fallback_service(static_service)
        .with_state(state)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
    Ok(())
}
