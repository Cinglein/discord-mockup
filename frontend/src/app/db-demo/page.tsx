'use client';

import type { Message } from "@bindings/Message";
import { useState, useEffect } from "react";

export default function Page() {
	async function getDB(): Promise<string | null> {
    const res = await fetch('/db', { method: 'GET' });
		if (res.ok) {
			try {
				const parsed: Message = await res.json();
				return parsed.data;
			} catch(e) {
				console.error(`Unable to parse json: ${e}`);
				return null;
			}
		} else {
			console.error(`Error with status code: ${res.status}`);
			return null;
		}
  }

	const [data, setData] = useState<string | null>(null);
	useEffect(() => {
		(async() => {
			setData(await getDB());
		})()
	}, [setData]);

	if (data === null) return <p>Loading…</p>;
	return (
		<div>{data}</div>
	);
}
