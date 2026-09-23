declare module 'react' {
  const React: any;
  export default React;
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((current: T) => T)) => void];
}

declare module 'react-native' {
  export const ImageBackground: any;
  export const Pressable: any;
  export const ScrollView: any;
  export const StyleSheet: { create<T>(styles: T): T };
  export const Text: any;
  export const View: any;
  export const SafeAreaView: any;
  export const StatusBar: any;
  export const TouchableOpacity: any;
}

declare module 'expo' {
  export function registerRootComponent(component: any): void;
}

declare namespace JSX {
  interface IntrinsicElements { [elemName: string]: any }
}
