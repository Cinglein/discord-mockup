use crate::{snapshot::Update, user::UserId, Sender};
use axum::{
    extract::{ws::WebSocket, State, WebSocketUpgrade},
    response::{sse::Event, IntoResponse},
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use ts_rs::TS;
use utoipa::ToSchema;

pub const VOICE_WS_PATH: &str = "/voice-ws";

pub type VoiceSender = broadcast::Sender<VoiceSignal>;

#[derive(Clone, Default)]
pub struct VoiceState {
    channels: Arc<RwLock<HashMap<i32, HashSet<UserId>>>>,
}

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

impl VoiceState {
    pub async fn add_user(&self, channel_id: i32, user_id: UserId) {
        let mut channels = self.channels.write().await;
        channels.entry(channel_id).or_default().insert(user_id);
    }

    pub async fn remove_user(&self, channel_id: i32, user_id: UserId) {
        let mut channels = self.channels.write().await;
        if let Some(users) = channels.get_mut(&channel_id) {
            users.remove(&user_id);
            if users.is_empty() {
                channels.remove(&channel_id);
            }
        }
    }
}

pub async fn voice_ws(
    ws: WebSocketUpgrade,
    State(voice_sender): State<VoiceSender>,
    State(update_sender): State<Sender>,
    State(voice_state): State<VoiceState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| {
        handle_voice_socket(socket, voice_sender, update_sender, voice_state)
    })
}

async fn handle_voice_socket(
    socket: WebSocket,
    voice_sender: VoiceSender,
    update_sender: Sender,
    voice_state: VoiceState,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let mut rx = voice_sender.subscribe();

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
    let tx = voice_sender.clone();
    let update_tx = update_sender.clone();
    let state = voice_state.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let axum::extract::ws::Message::Text(text) = msg {
                if let Ok(signal) = serde_json::from_str::<VoiceSignal>(&text) {
                    // Track voice state and send SSE updates
                    match &signal {
                        VoiceSignal::Join {
                            user_id,
                            channel_id,
                        } => {
                            state.add_user(*channel_id, *user_id).await;
                            let event = Event::default()
                                .json_data(Update::VoiceJoin {
                                    user_id: *user_id,
                                    channel_id: *channel_id,
                                })
                                .ok();
                            if let Some(evt) = event {
                                let _ = update_tx.send(evt);
                            }
                        }
                        VoiceSignal::Leave {
                            user_id,
                            channel_id,
                        } => {
                            state.remove_user(*channel_id, *user_id).await;
                            let event = Event::default()
                                .json_data(Update::VoiceLeave {
                                    user_id: *user_id,
                                    channel_id: *channel_id,
                                })
                                .ok();
                            if let Some(evt) = event {
                                let _ = update_tx.send(evt);
                            }
                        }
                        _ => {}
                    }
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
