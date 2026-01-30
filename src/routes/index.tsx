import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowRight,
  Layers,
  List,
  Infinity as InfinityIcon,
  Radio,
  Zap,
  Clock,
  Bookmark,
  Share2,
  Loader,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {


  return (
    <div>
      Welcome to the homepage!
    </div>
  );
}
