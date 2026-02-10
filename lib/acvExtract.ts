import type { TreeStructure, TreeNode } from "@/lib/types";

export interface ACVChainText {
  attribute: string;
  consequence: string;
  value: string;
}

export interface StimulusGroup {
  stimulus: string;
  chains: ACVChainText[];
}

export interface ExtractOptions {
  requireCompletedFlag?: boolean;     // default: true
  includeEmptyStimuli?: boolean;      // default: false
  includeIncompleteChains?: boolean;  // default: false
  mergeConsequencePath?: boolean;     // default: false
  checkSuperSet?: boolean;            // default: true
}

export function extractStimulusACVGroups(
  tree: TreeStructure,
  opts: ExtractOptions = {}
): StimulusGroup[] {
  const {
    requireCompletedFlag = true,
    includeEmptyStimuli = false,
    includeIncompleteChains = false,
    mergeConsequencePath = false,
    checkSuperSet = true,
  } = opts;

  const byId = new Map<number, TreeNode>(tree.nodes.map(n => [n.id, n]));

  const isCompleted = (n?: TreeNode) =>
    !!n && n.is_value_path_completed === true;

  const parentsOf = (n?: TreeNode): TreeNode[] =>
    (n?.parents || [])
      .map(id => byId.get(id))
      .filter((p): p is TreeNode => !!p);

  const childrenById = new Map<number, TreeNode[]>();
  for (const node of tree.nodes) {
    for (const pid of node.parents || []) {
      const arr = childrenById.get(pid) || [];
      arr.push(node);
      childrenById.set(pid, arr);
    }
  }
  const childrenOf = (n?: TreeNode): TreeNode[] =>
    n ? (childrenById.get(n.id) || []) : [];

  const allAncestorsWithLabel = (start: TreeNode, want: string): TreeNode[] => {
    const seen = new Set<number>();
    const out: TreeNode[] = [];
    const q: number[] = [...(start.parents || [])];
    while (q.length) {
      const pid = q.shift()!;
      if (seen.has(pid)) continue;
      seen.add(pid);
      const p = byId.get(pid);
      if (!p) continue;
      if (p.label === want) out.push(p);
      if (p.parents?.length) q.push(...p.parents);
    }
    return out;
  };

  type AttrHit = { attr: TreeNode; topConsequence: TreeNode; pathConsLeafToTop: TreeNode[] };
  function attributesViaConsequence(startCons: TreeNode): AttrHit[] {
    const out: AttrHit[] = [];
    const seen = new Set<string>();
    type State = { cons: TreeNode; path: TreeNode[] };
    const q: State[] = [{ cons: startCons, path: [startCons] }];
    while (q.length) {
      const { cons, path } = q.shift()!;
      const key = `${cons.id}|${path.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const p of parentsOf(cons)) {
        if (p.label === "ATTRIBUTE") {
          out.push({ attr: p, topConsequence: cons, pathConsLeafToTop: path.slice() });
        } else if (p.label === "CONSEQUENCE") {
          q.push({ cons: p, path: [...path, p] });
        }
      }
    }
    return out;
  }

  type RawChain = {
    stim: TreeNode;
    attr: TreeNode;
    consPathTopToLeaf: TreeNode[];
    val?: TreeNode;
  };

  const chainKey = (c: RawChain): string => {
    const consIds = c.consPathTopToLeaf.map(x => x.id).join(",");
    return `${c.stim.id}|${c.attr.id}|${consIds}|${c.val ? c.val.id : ""}`;
  };

  const addToMapUnique = <T>(map: Map<string, T>, key: string, value: T) => {
    if (!map.has(key)) map.set(key, value);
  };

  const rawMap = new Map<string, RawChain>();

  for (const val of tree.nodes.filter(n => n.label === "VALUE")) {
    const consParents = parentsOf(val).filter(p => p.label === "CONSEQUENCE");
    for (const consLeaf of consParents) {
      const hits = attributesViaConsequence(consLeaf);
      for (const { attr, pathConsLeafToTop } of hits) {
        const consPathTopToLeaf = pathConsLeafToTop.slice().reverse();
        for (const stim of allAncestorsWithLabel(attr, "STIMULUS")) {
          addToMapUnique(rawMap, chainKey({ stim, attr, consPathTopToLeaf, val }),
            { stim, attr, consPathTopToLeaf, val });
        }
      }
    }
  }

  for (const cons of tree.nodes.filter(n => n.label === "CONSEQUENCE")) {
    const hits = attributesViaConsequence(cons);
    for (const { attr, pathConsLeafToTop } of hits) {
      const consPathTopToLeaf = pathConsLeafToTop.slice().reverse();
      for (const stim of allAncestorsWithLabel(attr, "STIMULUS")) {
        addToMapUnique(rawMap, chainKey({ stim, attr, consPathTopToLeaf }),
          { stim, attr, consPathTopToLeaf });
      }
    }
  }

  for (const attr of tree.nodes.filter(n => n.label === "ATTRIBUTE")) {
    for (const stim of allAncestorsWithLabel(attr, "STIMULUS")) {
      addToMapUnique(rawMap, chainKey({ stim, attr, consPathTopToLeaf: [] }),
        { stim, attr, consPathTopToLeaf: [] });
    }
  }

  let chains = Array.from(rawMap.values());

  if (requireCompletedFlag) {
    const isCompletedSafe = (n?: TreeNode) => (!!n ? isCompleted(n) : true);
    chains = chains.filter(c => {
      const stimOk = isCompletedSafe(c.stim);
      const attrOk = isCompletedSafe(c.attr);
      if (c.val) {
        return stimOk && attrOk && c.consPathTopToLeaf.every(isCompletedSafe) && isCompletedSafe(c.val);
      } else if (c.consPathTopToLeaf.length) {
        return stimOk && attrOk;
      } else {
        return stimOk && attrOk;
      }
    });
  }

  if (!includeIncompleteChains) {
    chains = chains.filter(c => !!c.val);
  }

  if (checkSuperSet) {
    const hasHigherLevel = new Set<string>();
    for (const c of chains) {
      if (c.consPathTopToLeaf.length > 0 || c.val) {
        hasHigherLevel.add(`${c.stim.id}|${c.attr.id}`);
      }
    }
    chains = chains.filter(c =>
      !(c.consPathTopToLeaf.length === 0 && !c.val && hasHigherLevel.has(`${c.stim.id}|${c.attr.id}`))
    );

    const fullByConsPath = new Set<string>();
    for (const c of chains) {
      if (c.val) {
        const consIds = c.consPathTopToLeaf.map(x => x.id).join(",");
        fullByConsPath.add(`${c.stim.id}|${c.attr.id}|${consIds}`);
      }
    }
    chains = chains.filter(c => {
      if (!c.val && c.consPathTopToLeaf.length > 0) {
        const consIds = c.consPathTopToLeaf.map(x => x.id).join(",");
        return !fullByConsPath.has(`${c.stim.id}|${c.attr.id}|${consIds}`);
      }
      return true;
    });
  }

  if (mergeConsequencePath) {
    const keySA = (c: RawChain) => `${c.stim.id}|${c.attr.id}`;
    const bySA = new Map<string, RawChain[]>();
    for (const c of chains) {
      const k = keySA(c);
      const arr = bySA.get(k) || [];
      arr.push(c);
      bySA.set(k, arr);
    }

    const isPrefix = (a: number[], b: number[]) => {
      if (a.length >= b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    };

    const filtered: RawChain[] = [];

    Array.from(bySA.values()).forEach(list => {
      const paths = list.map(c => c.consPathTopToLeaf.map(n => n.id));
      for (let i = 0; i < list.length; i++) {
        const ci = list[i];
        const pi = paths[i];

        if (pi.length === 0 && list.some((_, j) => j !== i && paths[j].length > 0)) {
          continue;
        }

        let hasStrictSuperPath = false;
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const pj = paths[j];
          if (isPrefix(pi, pj)) {
            hasStrictSuperPath = true;
            break;
          }
        }
        if (hasStrictSuperPath) continue;

        filtered.push(ci);
      }
    });

    chains = filtered;
  }

  const groupsByStimulusId = new Map<number, StimulusGroup>();
  function pushChain(
    stim: TreeNode,
    attr: TreeNode,
    consPathTopToLeaf: TreeNode[],
    val?: TreeNode
  ) {
    let g = groupsByStimulusId.get(stim.id);
    if (!g) {
      g = { stimulus: stim.conclusion, chains: [] };
      groupsByStimulusId.set(stim.id, g);
    }
    const consequenceText = consPathTopToLeaf.length === 0
      ? ""
      : mergeConsequencePath
        ? consPathTopToLeaf.map(c => c.conclusion ?? "").join(" > ")
        : consPathTopToLeaf[0]?.conclusion ?? "";

    g.chains.push({
      attribute: attr.conclusion ?? "",
      consequence: consequenceText,
      value: val?.conclusion ?? "",
    });
  }

  for (const c of chains) {
    pushChain(c.stim, c.attr, c.consPathTopToLeaf, c.val);
  }

  const stimuli = tree.nodes.filter(n => n.label === "STIMULUS");
  const result: StimulusGroup[] = [];
  for (const stim of stimuli) {
    const group = groupsByStimulusId.get(stim.id);
    if (group) {
      group.chains.sort((a, b) => {
        const rank = (c: ACVChainText) => (c.value ? 0 : (c.consequence ? 1 : 2));
        const r = rank(a) - rank(b);
        return r !== 0 ? r
          : a.attribute.localeCompare(b.attribute)
          || a.consequence.localeCompare(b.consequence)
          || a.value.localeCompare(b.value);
      });
      result.push(group);
    } else if (includeEmptyStimuli) {
      result.push({ stimulus: stim.conclusion, chains: [] });
    }
  }

  return result;
}
