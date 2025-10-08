use crate::user::UserId;
use axum::{
    extract::{ws::WebSocket, State, WebSocketUpgrade},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use ts_rs::TS;
use utoipa::ToSchema;

pub const VOICE_WS_PATH: &str = "/voice-ws";

pub type VoiceSender = broadcast::Sender<VoiceSignal>;

#[derive(Serialize, Deserialize, Clone, Debug, TS, ToSchema)]
#[ts(export, export_to = "../../frontend/src/bindings/")]
#[serde(tag = "type")]
pub enum VoiceSignal {
    Join {
        user_id: UserId,
        channel_id: i32,
    },
    Leave {
        user_id: UserId,
        channel_id: i32,
    },
    Offer {
        from: UserId,
        to: UserId,
        channel_id: i32,
        sdp: String,
    },
    Answer {
        from: UserId,
        to: UserId,
        channel_id: i32,
        sdp: String,
    },
    IceCandidate {
        from: UserId,
        to: UserId,
        channel_id: i32,
        candidate: String,
    },
}

pub async fn voice_ws(
    ws: WebSocketUpgrade,
    State(sender): State<VoiceSender>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_voice_socket(socket, sender))
}

async fn handle_voice_socket(socket: WebSocket, sender: VoiceSender) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let mut rx = sender.subscribe();

    // Spawn task to send broadcasts to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(signal) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&signal) {
                if ws_sender
                    .send(axum::extract::ws::Message::Text(json.into()))
                    .await
                    .is_err()
                {
                    break;
                }
            }
        }
    });

    // Spawn task to receive messages from this client and broadcast
    let tx = sender.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let axum::extract::ws::Message::Text(text) = msg {
                if let Ok(signal) = serde_json::from_str::<VoiceSignal>(&text) {
                    let _ = tx.send(signal);
                }
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }
}
