import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Download, Video, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-violet-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 -left-48 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div
          className="absolute bottom-1/4 -right-48 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '6s', animationDelay: '1s' }}
        />
      </div>

      <div className="relative z-10 text-center space-y-8 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-3 bg-violet-500/10 backdrop-blur-sm border border-violet-500/30 rounded-full px-6 py-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <span className="text-sm font-medium text-violet-300 tracking-wide">
            Premium Quality Downloads
          </span>
        </div>

        <h1
          className="text-8xl md:text-9xl font-black tracking-tighter"
          style={{
            background: 'linear-gradient(to bottom right, #ffffff, #a78bfa, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          YOUTUBE
        </h1>

        <p className="text-2xl md:text-3xl text-violet-200/80 font-light tracking-wide max-w-2xl mx-auto">
          Download any YouTube video in the highest quality available.
          Fast, simple, and powerful.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
          <Link to="/download">
            <Button
              size="lg"
              className="h-16 px-10 bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-lg shadow-2xl shadow-violet-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/60 hover:scale-105 group"
            >
              <Download className="w-6 h-6 mr-3 group-hover:animate-bounce" />
              Start Downloading
              <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
          {[
            {
              icon: Video,
              title: "Highest Quality",
              description: "Always downloads the best available resolution"
            },
            {
              icon: Zap,
              title: "Lightning Fast",
              description: "Direct downloads with optimized streaming"
            },
            {
              icon: Download,
              title: "Auto-Save",
              description: "Automatically saves to your Downloads folder"
            }
          ].map((feature, idx) => (
            <div
              key={idx}
              className="bg-slate-900/80 backdrop-blur-xl border border-violet-500/30 rounded-2xl p-6 space-y-3 hover:border-violet-500/60 transition-all duration-300 hover:scale-105"
            >
              <div className="w-12 h-12 bg-linear-to-br from-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">{feature.title}</h3>
              <p className="text-violet-300/80 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Missing ArrowRight import fix
import { ArrowRight } from "lucide-react";
