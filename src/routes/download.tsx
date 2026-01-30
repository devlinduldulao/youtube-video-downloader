import { DownloadPage } from "@/components/download-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/download")({
    component: DownloadPageRoute,
});

function DownloadPageRoute() {
    return <DownloadPage />;
}
