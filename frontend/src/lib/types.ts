// Tipos espelham as respostas do backend (backend/app/engine/solver.py).
export type Num = { value: number; frac: string }
export type Relation = '<=' | '>=' | '='
export type Kind = 'continuous' | 'integer' | 'binary'
export type Sense = 'max' | 'min'
export type Method = 'bigm' | 'twophase'
export type IntegerMode = 'none' | 'marked' | 'all'

export interface VariableForm { name: string; kind: Kind; lower: number | null; upper: number | null }
export interface ConstraintForm { name: string; coefficients: number[]; relation: Relation; rhs: number }
export interface Problem { name: string; sense: Sense; objective: number[]; variables: VariableForm[]; constraints: ConstraintForm[] }
export interface ExampleContext { statement: string; objective: string; constraints: string[] }
export interface Example {
  id: string; title: string; category: string; description: string; highlights: string[]
  context?: ExampleContext; problem: Problem
}

export interface Snapshot {
  index: number; phase: number; title: string; note: string
  columns: string[]; kinds: string[]; basis: string[]
  cells_dec: string[][]; cells_frac: string[][]
  ratios_dec: (string | null)[] | null; ratios_frac: (string | null)[] | null
  entering: string | null; entering_col: number | null; leaving: string | null
  pivot: { row: number; col: number } | null
  pivot_value: { dec: string; frac: string } | null
  operations_dec: string[]; operations_frac: string[]
  x_dec: string[]; x_frac: string[]
  z_label: string; z_dec: string; z_frac: string
}

export interface LPResult {
  status: 'optimal' | 'infeasible' | 'unbounded'
  message: string; variables: string[]
  x: Num[] | null; z: Num | null
  iterations: Snapshot[]; pivots: number
  degenerate: boolean; degenerate_pivots: number; bland_used: boolean
  artificial: number; method_used: 'standard' | 'bigm' | 'twophase'
  validation?: { feasible: boolean; violations: string[]; objective_recomputed: Num; matches_tableau: boolean }
}

export interface Alternative { x: Num[]; z: Num; entering: string; leaving: string; same_objective: boolean; snapshot: Snapshot }
export interface Multiple {
  exists: boolean; zero_reduced_cost: string[]; alternatives: Alternative[]; unbounded_rays: string[]
  points: Num[][]; criterion?: string
}

export interface Rounding { x: Num[]; z: Num; feasible: boolean; violations: string[] }
export interface BBBound { var: string; op: '<=' | '>='; value: number }
export type BBDecision = 'branched' | 'integer' | 'infeasible' | 'unbounded' | 'pruned_bound' | 'node_limit'
export interface BBNode {
  id: number; parent: number | null; depth: number; branch: string; status: string | null
  z: Num | null; x: Num[] | null; decision: BBDecision | null
  branch_var: string | null; note: string; iterations?: number
  // Detalhamento (versão 1.2; ausente em resultados gerados pela versão 1.1)
  constraints?: string[]; bound?: BBBound | null; bounds?: { lower: (string | null)[]; upper: (string | null)[] }
  branch_value?: Num | null; floor?: number | null; ceil?: number | null; pivots?: number; tableau?: Snapshot | null
}
export interface BBStats {
  explored: number; branched: number; infeasible: number; unbounded: number; pruned_bound: number; integer_nodes: number; pending: number
  max_depth: number; total_pivots: number; root_z: Num | null; incumbent_z: Num | null; gap: Num | null
  root_integral: boolean; final_status: 'root_integral' | 'proven' | 'node_limit' | 'no_integer'; proven_optimal: boolean
  branching_rule: string; search_order: string
}
export interface BranchAndBound {
  status: string; nodes: BBNode[]; explored: number; node_limit: number; node_limit_hit: boolean
  incumbent: { x: Num[]; z: Num; node: number } | null; proven_optimal: boolean
  stats?: BBStats; incumbent_node?: number | null; incumbent_iterations?: Snapshot[]; tableau_limit?: number
}
export interface IntegerAvailable {
  available?: undefined; scope: string; variables: string[]; relaxation_is_integer: boolean
  rounding: { simple: Rounding; neighbor: Rounding | null; combinations_checked: number; skipped: boolean; fractional_variables: string[] }
  branch_and_bound: BranchAndBound
}
export type IntegerInfo = { available: false; reason: string } | IntegerAvailable

export interface Sensitivity {
  available: boolean; reason?: string; objective_note?: string
  rhs?: { constraint: string; origin: number | null; shadow_price: Num; rhs: Num; lower: Num | null; upper: Num | null; binding: boolean }[]
  objective?: { variable: string; coefficient: Num; lower: Num | null; upper: Num | null; basic: boolean }[]
  reduced_costs?: { variable: string; value: Num; reduced_cost: Num }[]
}

export interface DualInfo {
  model_lines: string[]; note: string
  correspondence: { rows: { primal: string; dual_var: string; sign: string }[]; columns: { primal_var: string; dual_constraint: string; relation: string }[] }
  result: LPResult
  strong_duality: { holds: boolean; z: Num; w: Num; constant: Num } | null
}

export interface GraphData {
  box: [number, number, number, number]; polygon: number[][]
  constraints: { label: string; kind: string; relation: string; segment: number[][] }[]
  vertices: { x: number; y: number; z: number; optimal: boolean }[]
  level_curves: { z: number; segment: number[][]; optimal: boolean }[]
  integer_points: number[][]
  optimum: { x: number; y: number; z: number } | null
  integer_optimum: { x: number; y: number; z: number } | null
  rounding: { simple?: { x: number; y: number; z: number; feasible: boolean }; neighbor?: { x: number; y: number; z: number; feasible: boolean } } | null
  optimal_segment: number[][] | null; objective: number[]; var_names: string[]
}

export interface SolveResponse {
  method: Method; method_used: string; sense: Sense; variables: string[]
  formulation: { primal: string[] }
  standard_form: { columns: string[]; kinds: string[]; notes: string[] }
  relaxation: LPResult; multiple: Multiple; dual: DualInfo; sensitivity: Sensitivity
  integer: IntegerInfo; graph: GraphData | null; warnings: string[]
}

export interface ProjectRef { id: string; name: string }
export interface NodeIterations { status: LPResult['status']; message: string; variables: string[]; x: Num[] | null; z: Num | null; iterations: Snapshot[]; pivots: number }
export interface HistoryItem { id: string; date: string; problem: Problem; method: Method; integer: IntegerMode; summary: string }
