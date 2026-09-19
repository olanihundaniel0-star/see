import { memo, useEffect, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BOOT_MS = 10_000;

// dino sprite: Chrome RUN1/RUN2 bodies from offline-sprite-1x.png (drawn pad-0, heads aligned),
// tail-spike block removed, legs replaced with the mirrored stride cycle (feet baseline row 22).
const FRAMES = [  [
    '                                            ',
    '                             ███████████████',
    '                           █████████████████',
    '                           █████████████████',
    '                           █████████████████',
    '                           █████████████████',
    '                           █████████████████',
    '                           ████████████████▀',
    '                         ▄▄████████▀▀▀▀▀▀▀▀ ',
    '                      ▄▄▄██████████         ',
    '                   ▄▄▄█████████████▄▄▄▄     ',
    '       ████▄▄    ▄▄████████████████▀▀██     ',
    '       ██████▄▄▄▄██████████████████  ▀▀     ',
    '       ████████████████████████████         ',
    '       ▀▀██████████████████████████         ',
    '         ▀▀██████████████████████           ',
    '           ▀▀██████████████████▀▀           ',
    '             ▀▀██████████████▀▀             ',
    '               ▀▀██████▀▀████               ',
    '        █████▀      █████▀                  ',
    '       ▄███████▄    ▄███████▄               ',
    '      ▄█████████▄  ▄█████████▄              ',
    '      ▄▄▄▄▄▄▄▄▄▄   ▄▄▄▄▄▄▄▄▄▄               ',
    '                                            ',
  ],  [
    '                                            ',
    '                         ███████████████████',
    '                         ███████████████████',
    '                         ███████████████████',
    '                         ███████████████████',
    '                         ███████████████████',
    '                         ███████████████████',
    '                       ▄▄███████████████████',
    '                    ▄▄▄█████████████████████',
    '                 ▄▄▄█████████████████████▀▀▀',
    '            ▄▄▄▄▄████████████████████████   ',
    '     ████████████████████████████████████   ',
    '     ████████████████████████████████████   ',
    '     ████████████████████████████████▀▀▀▀   ',
    '     ▀▀██████████████████████████████       ',
    '       ▀▀██████████████████████████         ',
    '         ▀▀████████████████████████         ',
    '           ▀▀████████████████████▀▀         ',
    '             ████████████████████           ',
    '                  ▀█████      ▀█████        ',
    '               ▄███████▄    ▄███████▄       ',
    '              ▄█████████▄  ▄█████████▄      ',
    '               ▄▄▄▄▄▄▄▄▄▄   ▄▄▄▄▄▄▄▄▄▄      ',
    '                                            ',
  ]
];

const STREAM_LINES = [
  "$ ./see --xray --sweep=radar --out=/ops/events",
  "fn sweep(): while eject: await track(hot=True, ts=now())",
  "$ git push origin headless-tyrannosaurus",
  "daniel@see-os:~$ sudo journalctl -u gateway --since today | head -40",
  "==> scanning 66,630 luma objects .... [OK]",
  "$ curl -s https://devpost.com/api/hackathons | jq '.hackathons[].title'",
  "def retarget(dino): dino.os.close() if speed < hunger else run()",
  "$ ./deploy.sh --prod && curl -fs https://see-backend.onrender.com/health"
];

const BOOT_LOG = [
  "> mounting /ops filesystem ........ OK",
  "> supabase.link ................. OK",
  "> radar.sweep() ................. SWEEP",
  "> gmail.poll --credentials ....... OK",
  "> event.stream --devpost --luma .. SEEDED",
  "> terminal.spawn --tyrannosaurus. RUNNING"
];

const STREAM = (() => {
  let out = "";
  for (let i = 0; i < 40; i += 1) {
    out += ` ${STREAM_LINES[i % STREAM_LINES.length]}  ;;  `;
  }
  return out;
})();

const GROUND = (() => {
  const chunk = "·   ·   ·   ·   ▄▄▄   ·   ·   ·   ▄▄▄▄▄   ·   ·   ·  ";
  let out = "";
  while (out.length < 640) out += chunk;
  return out;
})();

const RUN_SPEED_PX = 260;
const STRIDE_PX = 43;

const DinoFrame = memo(function DinoFrame({ frame, fontSize, rowH }: { frame: string[]; fontSize: number; rowH: number }) {
  return (
    <View>
      {frame.map((row, index) => (
        <Text
          key={index}
          className="text-white"
          style={{ fontFamily: "monospace", fontSize, height: rowH, lineHeight: rowH }}
        >
          {row.length ? row : "\u00A0"}
        </Text>
      ))}
    </View>
  );
});

export default function BootScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 40);
    return () => clearInterval(timer);
  }, []);

  const elapsed = Math.min(tick * 40, BOOT_MS);
  const progress = elapsed / BOOT_MS;
  const percent = Math.min(100, Math.round(progress * 100));

  const totalPx = elapsed * (RUN_SPEED_PX / 1000);
  const frameIndex = Math.floor(totalPx / STRIDE_PX) % FRAMES.length;
  const frame = FRAMES[frameIndex];

  const streamWidth = 96;
  const streamCharPx = 6.6;
  const offsetChars = Math.floor(totalPx / streamCharPx) % Math.max(1, STREAM.length - streamWidth);
  const visibleStream = STREAM.slice(offsetChars, offsetChars + streamWidth);
  const groundOffset = offsetChars % GROUND.length;
  const visibleGround = GROUND.slice(groundOffset, groundOffset + streamWidth);

  const compact = height < 700;
  const dinoFontSize = compact ? 9 : 11;
  const dinoRowH = compact ? 10 : 12;
  const dinoLeft = Math.round(width * 0.05);
  const visibleLogCount = Math.min(BOOT_LOG.length, Math.floor(progress * BOOT_LOG.length) + 1);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <View className="flex-1 px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-mono text-[10px] tracking-[0.14em] text-[#8f9194]">{"// SEE_OS"}</Text>
          <Text className="font-mono text-[10px] tracking-[0.14em] text-[#8f9194]">{"v0.3.0 // BOOT_SEQUENCE"}</Text>
        </View>

        <View className="mt-6 gap-2" style={{ height: compact ? 130 : 200 }}>
          {BOOT_LOG.slice(0, visibleLogCount).map((line, index) => (
            <Text key={index} className="font-mono text-[10px] text-[#c5c6ca]">
              {line}
            </Text>
          ))}
          {progress < 1 ? (
            <Text className="font-mono text-[10px] text-emerald-400">
              {`$ dino --run --no-jump ${">>>".slice(0, (Math.floor(progress * 20) % 4))}_`}
            </Text>
          ) : null}
        </View>

        <View className="flex-1 justify-center overflow-hidden">
          <View
            style={{
              position: "absolute",
              bottom: 44,
              left: dinoLeft
            }}
          >
            <DinoFrame frame={frame} fontSize={dinoFontSize} rowH={dinoRowH} />
          </View>

          <View style={{ position: "absolute", bottom: 28, left: 0, right: 0 }}>
            <Text numberOfLines={1} className="font-mono text-[11px] text-zinc-300">
              {visibleStream}
            </Text>
          </View>
          <View style={{ position: "absolute", bottom: 16, left: 0, right: 0 }}>
            <Text numberOfLines={1} className="font-mono text-[10px] text-zinc-500">
              {visibleGround}
            </Text>
          </View>
        </View>

        <View className="mb-8 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-[10px] tracking-[0.14em] text-white">{`> BOOT ${percent}%`}</Text>
            <Text className="font-mono text-[10px] text-[#8f9194]">{"T+10S"}</Text>
          </View>
          <View className="flex-row gap-1">
            {Array.from({ length: 20 }).map((_, index) => (
              <View
                key={index}
                className={"h-1 flex-1 " + (index < Math.floor(progress * 20) ? "bg-white" : "bg-white/15")}
              />
            ))}
          </View>
          <Text className="text-center font-mono text-[9px] text-zinc-600">
            JURASSIC_RUNTIME // EST. 66,000,000 BCE
          </Text>
        </View>
      </View>
    </View>
  );
}