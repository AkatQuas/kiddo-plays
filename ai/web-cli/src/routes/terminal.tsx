import { createFileRoute } from "@tanstack/react-router";
import TerminalApp from "../components/Terminal";

export const Route = createFileRoute("/terminal")({
	component: TerminalPage,
	head: () => ({
		meta: [
			{ title: "Web Terminal - Web CLI" },
			{
				name: "description",
				content:
					"Browser-based interactive system terminal powered by TanStack Start",
			},
		],
	}),
});

function TerminalPage() {
	return (
		<div className="flex flex-col h-[calc(100vh-4rem)] p-4 rounded">
			<TerminalApp />
		</div>
	);
}
