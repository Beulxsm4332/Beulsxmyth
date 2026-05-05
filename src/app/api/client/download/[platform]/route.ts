import { NextResponse } from "next/server";

const PLATFORM_CONFIG: Record<
  string,
  {
    version: string;
    downloadUrl: string;
    changelog: string;
    mandatory: boolean;
  }
> = {
  windows: {
    version: "1.0.0",
    downloadUrl: "https://beulrock.com/downloads/beulrock-windows-1.0.0.exe",
    changelog:
      "Initial release with core scripting engine, server browser, and executor functionality.",
    mandatory: false,
  },
  macos: {
    version: "1.0.0",
    downloadUrl: "https://beulrock.com/downloads/beulrock-macos-1.0.0.dmg",
    changelog:
      "Initial release with core scripting engine, server browser, and executor functionality.",
    mandatory: false,
  },
  ios: {
    version: "1.0.0",
    downloadUrl: "https://beulrock.com/downloads/beulrock-ios-1.0.0.ipa",
    changelog:
      "Initial release with limited scripting support and server monitoring.",
    mandatory: false,
  },
  android: {
    version: "1.0.0",
    downloadUrl: "https://beulrock.com/downloads/beulrock-android-1.0.0.apk",
    changelog:
      "Initial release with limited scripting support and server monitoring.",
    mandatory: false,
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    const config = PLATFORM_CONFIG[platform.toLowerCase()];

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PLATFORM",
            message: `Unsupported platform: ${platform}. Supported platforms: windows, macos, ios, android`,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: config },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[client/download] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch download info",
        },
      },
      { status: 500 }
    );
  }
}
