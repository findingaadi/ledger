import { useState } from "react";
import { Text, View } from "react-native";

import { Locker, type LockerPhase } from "@/components/locker";
import { ShelfView } from "@/components/shelf-view";

const PHASES: LockerPhase[] = ["login", "waiting", "unlock"];

/** Development only: the locked cabinet, with buttons to step through its states. */
export default function PreviewLocker() {
  const [phase, setPhase] = useState<LockerPhase>("intro");
  const [run, setRun] = useState(0);
  const [gone, setGone] = useState(false);
  if (!__DEV__) return null;
  const noop = () => {};
  return (
    <View style={{ flex: 1 }}>
      {phase === "unlock" ? (
        <ShelfView books={["November", "October", "September"].map((m, i) => ({ id: String(i), month: m, year: "2026" }))} onOpen={noop} onEnvelopes={noop} onTransactions={noop} onRefresh={noop} onSignOut={noop} />
      ) : null}
      {!gone ? <Locker key={run} phase={phase} onLogin={() => setPhase("waiting")} onUnlocked={() => setGone(true)} /> : null}
      <View style={{ position: "absolute", top: 4, right: 4, flexDirection: "row", gap: 6 }}>
        {PHASES.map((p) => (
          <Text key={p} onPress={() => setPhase(p)} style={{ color: "#fff", backgroundColor: "#0008", padding: 4, fontSize: 11 }}>
            {p}
          </Text>
        ))}
        <Text onPress={() => { setGone(false); setPhase("intro"); setRun((r) => r + 1); setTimeout(() => setPhase("login"), 200); }} style={{ color: "#fff", backgroundColor: "#0008", padding: 4, fontSize: 11 }}>
          replay
        </Text>
      </View>
    </View>
  );
}
