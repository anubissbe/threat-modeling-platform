// Type declarations for modules without TypeScript support

declare module 'pidusage' {
  interface ProcessUsage {
    pid: number;
    memory: number;
    cpu: number;
  }

  function pidusage(pid: number): Promise<ProcessUsage>;
  function pidusage(pids: number[]): Promise<{ [pid: number]: ProcessUsage }>;
  
  export = pidusage;
}

declare module 'autocannon' {
  interface AutocannonOptions {
    url: string;
    connections?: number;
    duration?: number;
    pipelining?: number;
    timeout?: number;
    headers?: { [key: string]: string };
  }

  interface AutocannonResult {
    requests: {
      total: number;
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
    };
    latency: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
    throughput: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
    };
    errors: number;
    timeouts: number;
    mismatches: number;
    non2xx: number;
  }

  function autocannon(options: AutocannonOptions): Promise<AutocannonResult>;
  
  export = autocannon;
}

declare module 'systeminformation' {
  interface CurrentLoadData {
    avgLoad: number;
    currentLoad: number;
    cpus: any[];
  }

  interface MemData {
    total: number;
    free: number;
    used: number;
    active: number;
    available: number;
    buffers: number;
    cached: number;
    slab: number;
    buffcache: number;
    swaptotal: number;
    swapused: number;
    swapfree: number;
  }

  interface NetworkStatsData {
    iface: string;
    operstate: string;
    rx_bytes: number;
    rx_dropped: number;
    rx_errors: number;
    tx_bytes: number;
    tx_dropped: number;
    tx_errors: number;
    rx_sec: number;
    tx_sec: number;
    ms: number;
  }

  interface FsSizeData {
    fs: string;
    type: string;
    size: number;
    used: number;
    available: number;
    use: number;
    mount: string;
  }

  interface OsData {
    platform: string;
    distro: string;
    release: string;
    codename: string;
    kernel: string;
    arch: string;
    hostname: string;
  }

  export function currentLoad(): Promise<CurrentLoadData>;
  export function mem(): Promise<MemData>;
  export function networkStats(): Promise<NetworkStatsData[]>;
  export function fsSize(): Promise<FsSizeData[]>;
  export function osInfo(): Promise<OsData>;
}