export interface Assembly {
  tick(): number
}

// 以下テンプレ

export interface Module {
  _free(strPtr: number): void
  HEAPU8: Uint8Array
  HEAPU16: Uint16Array
  HEAPF32: Float32Array
  _malloc(length: number): number
  ccall<T>(
    ident: string,
    returnType: string,
    argTypes: string[],
    args: number[]
  ): T
  intArrayFromString(
    stringy: string,
    dontAddNull?: boolean,
    length?: number
  ): number[]
  allocate(data: Uint8Array | number[], allocator: number): number
  asm: Assembly
}

export interface ModuleLoader {
  initialize(userModule?: Record): Promise<Module>
}

declare const loader: ModuleLoader
export default loader
