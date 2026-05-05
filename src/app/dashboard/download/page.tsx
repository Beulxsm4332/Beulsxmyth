"use client";

import { Download, Monitor, Apple, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";

const platforms = [
  {
    name: "Windows",
    icon: Monitor,
    ext: ".exe",
    version: "1.0.0",
    size: "45 MB",
    requirements: "Windows 10 or later, 64-bit",
    changelog: "Initial release with core execution engine",
  },
  {
    name: "macOS",
    icon: Apple,
    ext: ".dmg",
    version: "1.0.0",
    size: "52 MB",
    requirements: "macOS 11 (Big Sur) or later",
    changelog: "Initial release with Apple Silicon support",
  },
  {
    name: "iOS",
    icon: Smartphone,
    ext: ".ipa",
    version: "1.0.0",
    size: "28 MB",
    requirements: "iOS 15.0 or later",
    changelog: "Sideloading required, enterprise distribution",
  },
  {
    name: "Android",
    icon: Tablet,
    ext: ".apk",
    version: "1.0.0",
    size: "32 MB",
    requirements: "Android 8.0 or later",
    changelog: "Direct APK download, no Play Store required",
  },
];

export default function DownloadPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Download className="w-6 h-6 text-[#e74c3c]" /> Download Client
        </h1>
        <p className="text-[#a0a0a0] text-sm mt-1">Get the native Beulrock Executor for your platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {platforms.map((p) => (
          <div key={p.name} className="bg-[#111] border border-[#222] rounded-xl p-5 hover:border-[#333] transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#e74c3c]/10 flex items-center justify-center border border-[#e74c3c]/20">
                <p.icon className="w-6 h-6 text-[#e74c3c]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{p.name}</h3>
                <p className="text-xs text-[#a0a0a0]">v{p.version} • {p.size} • {p.ext}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mb-4">{p.requirements}</p>
            <Button className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white text-sm h-10">
              <Download className="w-4 h-4 mr-2" /> Download for {p.name}
            </Button>
          </div>
        ))}
      </div>

      {/* Installation instructions */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-6">
        <h3 className="text-sm font-bold text-white mb-4">Installation Instructions</h3>
        <div className="space-y-4">
          {[
            { platform: "Windows", steps: ["Download the .exe installer", "Run the installer as Administrator", "Follow the setup wizard", "Launch Beulrock Executor"] },
            { platform: "macOS", steps: ["Download the .dmg file", "Open the DMG and drag to Applications", "Allow access in Security & Privacy settings", "Launch Beulrock Executor"] },
            { platform: "iOS", steps: ["Download the .ipa file", "Use AltStore or Sideloadly to install", "Trust the developer certificate in Settings", "Launch Beulrock Executor"] },
            { platform: "Android", steps: ["Download the .apk file", "Enable 'Install from Unknown Sources'", "Open the APK and install", "Launch Beulrock Executor"] },
          ].map((inst) => (
            <div key={inst.platform} className="border-b border-[#1a1a1a] pb-4 last:border-0">
              <h4 className="text-xs font-semibold text-[#e74c3c] mb-2">{inst.platform}</h4>
              <ol className="space-y-1">
                {inst.steps.map((s, i) => (
                  <li key={i} className="text-xs text-[#a0a0a0] flex items-start gap-2">
                    <span className="text-zinc-600">{i + 1}.</span> {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
