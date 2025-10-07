'use client';

export default function Home() {
	return (
		<>
			<div className="font-sans">Axum and Next.js Template Page</div>
			<ul>
				<li><a className="text-blue-400" href="/swagger-ui/">API Docs</a></li>
				<li><a className="text-blue-400" href="/sse-demo/">SSE Demo</a></li>
				<li><a className="text-blue-400" href="/ws-demo/">WS Demo</a></li>
				<li><a className="text-blue-400" href="/db-demo/">DB Demo</a></li>
			</ul>
		</>
	);
}
