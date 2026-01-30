import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Box, Shield, Zap, Terminal } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#F0F0F0] font-mono selection:bg-[#D4FF00] selection:text-black overflow-hidden relative flex flex-col">
      {/* Background Grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Decorative Elements */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-[#D4FF00] rounded-full blur-[250px] opacity-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-[#D4FF00] rounded-full blur-[300px] opacity-5 pointer-events-none" />

      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl w-full text-center"
        >
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 mb-8 border border-[#333] bg-[#0A0A0A] px-4 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4FF00] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4FF00]"></span>
            </span>
            <span className="text-xs font-bold tracking-[0.2em] text-neutral-400">
              SYSTEM_ONLINE // V2.0.0
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-8 font-['Unbounded'] relative inline-block">
            YT_EXTRACT
            <div className="hidden md:block absolute -right-12 top-0 text-lg font-mono text-[#D4FF00] opacity-50 rotate-90 origin-left">
              [BETA]
            </div>
          </h1>

          <p className="max-w-2xl mx-auto text-neutral-400 text-lg md:text-xl leading-relaxed mb-12">
            Advanced YouTube protocol for local archival.
            <br className="hidden md:block" />
            Bypass restrictions. Maximize fidelity. Direct storage access.
          </p>

          {/* CTA Button */}
          <div className="flex justify-center mb-24">
            <Link to="/download">
              <Button
                className={cn(
                  "h-20 px-12 text-xl font-bold uppercase tracking-widest transition-all duration-300 rounded-none relative overflow-hidden group",
                  "bg-[#D4FF00] text-black hover:bg-[#b8dd00] hover:scale-[1.02]",
                  "border border-transparent hover:border-[#D4FF00]/50"
                )}
              >
                <span className="flex items-center gap-4">
                  INITIALIZE_PROTOCOL
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </span>
                {/* Button glow effect */}
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-30 bg-[linear-gradient(45deg,transparent,white,transparent)] bg-size-[200%_200%] animate-[shimmer_2s_infinite]" />
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
            {[
              {
                icon: Box,
                title: "CONTAINER_FORMAT",
                desc: "Automatic MP4 muxing. High compatibility. No conversion loss.",
              },
              {
                icon: Zap,
                title: "MAX_BITRATE",
                desc: "Prioritizes highest bitrate video/audio streams available.",
              },
              {
                icon: Shield,
                title: "LOCAL_STORAGE",
                desc: "Direct write to OS Downloads folder. No cloud reliance.",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group p-6 border border-neutral-800 bg-[#0A0A0A] hover:border-[#D4FF00]/30 transition-colors duration-300 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <feature.icon className="w-16 h-16 text-[#D4FF00]" />
                </div>
                <feature.icon className="w-8 h-8 text-[#D4FF00] mb-4" />
                <h3 className="text-lg font-bold font-['Unbounded'] mb-2 group-hover:text-[#D4FF00] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  {feature.desc}
                </p>
                {/* Corner accent */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-l border-b border-[#D4FF00] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-neutral-900 bg-[#050505]/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 flex justify-between items-center text-[10px] text-neutral-600 font-mono tracking-widest">
          <div className="flex gap-4">
            <span className="flex items-center gap-2">
              <Terminal className="w-3 h-3" />
              READY_STATE
            </span>
          </div>
          <div>EST. 2026 // VOID_TERMINAL_SYSTEM</div>
        </div>
      </footer>
    </div>
  );
}
