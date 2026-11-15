import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { BookPages } from "@/components/book-pages";
import { Heading, Ink, Line, PaperButton, PaperInput, PaperLink, PaperPage, Stamp } from "@/components/paper";
import { TransactionList } from "@/components/transaction-list";
import { WoodBar, WoodButton } from "@/components/wood";
import { day, gbp } from "@/lib/format";
import { paper, serif, wood } from "@/lib/theme";
import type { CycleState } from "@/lib/use-cycle";

const PAGES = ["To do", "Dashboard", "Transactions", "Bills"];

/** An open book: one pay cycle as four ledger pages that turn like paper. */
export function BookView({ state, onClose }: { state: CycleState; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 520);
  // Open on the to-do page when there is something to do, otherwise on the dashboard.
  const [first] = useState(() => (state.summary.left_to_assign !== 0 || state.summary.unfiled > 0 ? 0 : 1));
  const last = PAGES.length - 1;

  const footer = (index: number, go: (to: number) => void) => (
    <View style={styles.footer}>
      <Text style={styles.turn} onPress={() => go(index - 1)}>
        {index > 0 ? `‹ ${PAGES[index - 1]}` : ""}
      </Text>
      <Text style={styles.folio}>{index + 1}</Text>
      <Text style={[styles.turn, styles.turnRight]} onPress={() => go(index + 1)}>
        {index < last ? `${PAGES[index + 1]} ›` : ""}
      </Text>
    </View>
  );
  const dates = `${day(state.cycle.starts_at)} to ${state.cycle.ends_at ? day(state.cycle.ends_at) : "next payday"}`;

  const page = (index: number, go: (to: number) => void) => {
    switch (index) {
      case 0:
        return (
          <PaperPage title="To do" subtitle={dates} footer={footer(0, go)}>
            <TodoPage state={state} />
          </PaperPage>
        );
      case 1:
        return (
          <PaperPage title={state.cycle.name.split(" ")[0]} subtitle={state.summary.closed ? "cycle closed" : "cycle in progress"} footer={footer(1, go)}>
            <DashboardPage state={state} />
          </PaperPage>
        );
      case 2:
        return (
          <PaperPage title="Transactions" subtitle={`from payday, ${day(state.cycle.starts_at)}`} footer={footer(2, go)}>
            <TransactionList ledger from={state.cycle.starts_at} to={state.cycle.ends_at} reloadKey={state.reloadKey} onChanged={state.changed} empty="Nothing in this cycle yet." />
          </PaperPage>
        );
      default:
        return (
          <PaperPage title="Bills" subtitle="regular payments this cycle" footer={footer(3, go)}>
            <BillsPage state={state} />
          </PaperPage>
        );
    }
  };

  return (
    <View style={styles.screen}>
      <WoodBar title={state.cycle.name} left={<WoodButton label="Shelf" onPress={onClose} />} />
      <View style={[styles.book, { width: pageWidth }]}>
        <BookPages count={PAGES.length} first={first} width={pageWidth} names={PAGES} render={page} />
      </View>
    </View>
  );
}

function TodoPage({ state }: { state: CycleState }) {
  const { cycle, summary, left } = state;
  const [side, setSide] = useState<{ label: string; amount: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const available = summary.income - summary.carried_in;

  return (
    <>
      <Heading>Money in</Heading>
      <TransactionList status="income" from={cycle.starts_at} to={cycle.ends_at} reloadKey={state.reloadKey} onChanged={state.changed} empty="No income found in this cycle." />
      {state.manual.map((m) => (
        <Line key={m.id} label={m.label} note="entered by you" right={
          <>
            <Ink tone="green">{gbp(m.amount, true)}</Ink>
            <PaperLink label="Remove" onPress={() => state.removeSide(m)} />
          </>
        } />
      ))}
      {summary.carried_in > 0 ? <Line label="Shortfall carried from last cycle" right={<Ink tone="red">{gbp(-summary.carried_in, true)}</Ink>} /> : null}
      {side ? (
        <View>
          <PaperInput wide placeholder="Weekend shift" value={side.label} onChangeText={(label) => setSide({ ...side, label })} />
          <PaperInput wide placeholder="Amount in pounds" keyboardType="decimal-pad" value={side.amount} onChangeText={(amount) => setSide({ ...side, amount })} />
          <View style={styles.actions}>
            <PaperButton label="Add" onPress={async () => (await state.addSide(side.label, side.amount)) && setSide(null)} />
            <PaperLink label="Cancel" onPress={() => setSide(null)} />
          </View>
        </View>
      ) : (
        <PaperLink label="Add side income" onPress={() => setSide({ label: "", amount: "" })} />
      )}

      <Stamp
        label={left < 0 ? "Over-assigned" : "Left to assign"}
        value={gbp(Math.abs(left))}
        note={`of ${gbp(available)} available`}
        tone={left === 0 ? "green" : left > 0 ? "ink" : "red"}
      />
      {!state.saved ? <Ink tone="faint" small>Not saved yet. Amounts are filled in from your last cycle or each envelope&apos;s usual amount.</Ink> : null}

      <Ink tone="faint" small>Tick the envelopes in this month. What you save becomes each envelope&apos;s amount next payday.</Ink>
      {state.envelopes.map((e) => {
        const on = state.included[e.id] !== false;
        return (
          <Line
            key={e.id}
            label={
              <Text style={on ? undefined : styles.leftOut} onPress={() => state.toggleIncluded(e.id)}>
                <Text style={styles.tick}>{on ? "☑" : "☐"}</Text> {e.name}
              </Text>
            }
            right={
              on ? (
                <PaperInput keyboardType="decimal-pad" value={state.amounts[e.id] ?? ""} onChangeText={(v) => state.setAmount(e.id, v)} />
              ) : (
                <Ink tone="faint" small>not this month</Ink>
              )
            }
          />
        );
      })}
      <PaperButton label="Send the rest to guilt-free" onPress={state.sendRest} />
      <PaperButton label="Save" primary onPress={state.save} />
      {state.message ? <Ink tone={/^(Saved|Reset)/.test(state.message) ? "green" : "red"} small>{state.message}</Ink> : null}

      {confirmReset ? (
        <View style={styles.confirm}>
          <Ink tone="red">Reset {cycle.name.split(" ")[0]}&apos;s budget?</Ink>
          <Ink small>
            Every envelope goes back to £0 and all {gbp(available)} becomes unassigned, so you can share it out again. Your
            transactions, side income and envelope defaults aren&apos;t changed.
          </Ink>
          <View style={styles.actions}>
            <PaperButton
              label="Yes, reset"
              primary
              onPress={async () => {
                setConfirmReset(false);
                await state.reset();
              }}
            />
            <PaperLink label="Cancel" onPress={() => setConfirmReset(false)} />
          </View>
        </View>
      ) : (
        <PaperLink label="Reset this month's budget" onPress={() => setConfirmReset(true)} />
      )}

      <Heading>Needs an envelope</Heading>
      <TransactionList status="unassigned" from={cycle.starts_at} to={cycle.ends_at} reloadKey={state.reloadKey} onChanged={state.changed} empty="Everything in this cycle is filed." />
    </>
  );
}

function DashboardPage({ state }: { state: CycleState }) {
  const { cycle, summary } = state;
  const guiltFree = summary.guilt_free_left;
  const spent = summary.envelopes.reduce((sum, e) => sum + e.spent, 0);

  if (!summary.assigned || guiltFree === null) {
    return (
      <>
        <Stamp label="Payday waiting" value="To do" note="assign this cycle's money first" tone="red" />
        <Line label="Income this cycle" right={<Ink>{gbp(summary.income)}</Ink>} />
        <Line label="Spent so far" right={<Ink>{gbp(spent)}</Ink>} />
      </>
    );
  }
  return (
    <>
      <Stamp
        label={summary.closed ? "Guilt-free at the end" : "Guilt-free left"}
        value={gbp(guiltFree)}
        note={summary.closed ? "with what was left in flexible envelopes" : "after overspending elsewhere"}
        tone={guiltFree >= 0 ? "green" : "red"}
      />
      {summary.envelopes.filter((e) => e.kind !== "guilt_free" && (e.included || e.spent !== 0)).map((e) => {
        const remaining = e.allocated - e.spent;
        const used = e.allocated > 0 ? Math.min(1, Math.max(0, e.spent / e.allocated)) : e.spent > 0 ? 1 : 0;
        return (
          <Line
            key={e.id}
            label={e.name}
            note={
              <View style={styles.meter}>
                <View style={[styles.meterFill, { width: `${used * 100}%`, backgroundColor: remaining < 0 ? paper.red : paper.ink }]} />
              </View>
            }
            right={<Ink tone={remaining < 0 ? "red" : "ink"} small>{remaining < 0 ? `${gbp(-remaining)} over` : `${gbp(remaining)} left`}</Ink>}
            onPress={() => router.push({ pathname: "/envelope/[id]", params: { id: e.id, cycle: cycle.id, from: cycle.starts_at, to: cycle.ends_at ?? "" } })}
          />
        );
      })}
      <Line label="Income this cycle" right={<Ink>{gbp(summary.income)}</Ink>} />
      <Line label="Spent so far" right={<Ink>{gbp(spent)}</Ink>} />
    </>
  );
}

function BillsPage({ state }: { state: CycleState }) {
  const { cycle, summary } = state;
  const bills = summary.envelopes.filter((e) => e.kind === "bill" && (e.included || e.spent !== 0));
  if (!bills.length) return <Ink tone="faint">No regular bills set up. Mark an envelope as a regular bill to see it here.</Ink>;
  return (
    <>
      {bills.map((b) => (
        <Line
          key={b.id}
          label={b.name}
          note={b.spent > 0 ? `paid ${gbp(b.spent)}` : `not paid yet, ${gbp(b.allocated)} set aside`}
          right={b.spent > 0 ? <Ink tone="green">✓ paid</Ink> : <Ink tone="faint">due</Ink>}
          onPress={() => router.push({ pathname: "/envelope/[id]", params: { id: b.id, cycle: cycle.id, from: cycle.starts_at, to: cycle.ends_at ?? "" } })}
        />
      ))}
      <Line label="Total paid" right={<Ink>{gbp(bills.reduce((sum, b) => sum + b.spent, 0))}</Ink>} />
      <Line label="Total set aside" right={<Ink>{gbp(bills.reduce((sum, b) => sum + b.allocated, 0))}</Ink>} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: wood.back[1] },
  book: { flex: 1, alignSelf: "center", backgroundColor: "#d9c9a0" },
  footer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: paper.rule },
  turn: { flex: 1, fontFamily: serif, fontSize: 13, fontStyle: "italic", color: paper.faint },
  turnRight: { textAlign: "right" },
  folio: { fontFamily: serif, fontSize: 13, color: paper.faint },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
  tick: { fontSize: 17, color: paper.ink },
  confirm: { gap: 6, marginTop: 10, padding: 12, borderWidth: 1.5, borderColor: paper.red, borderRadius: 6, backgroundColor: "rgba(161,42,34,0.06)" },
  leftOut: { color: paper.faint, textDecorationLine: "line-through" },
  meter: { height: 5, width: 150, marginTop: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: paper.faint, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.4)" },
  meterFill: { height: "100%" },
});
