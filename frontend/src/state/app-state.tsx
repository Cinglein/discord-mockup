'use client';

import { User } from "@bindings/User";
import { Server } from "@bindings/Server";
import { Channel } from "@bindings/Channel";
import { Message } from "@bindings/Message";
import { Snapshot } from "@bindings/Snapshot";

type State = {
	user: number,
	snapshot: Snapshot | null,
}
