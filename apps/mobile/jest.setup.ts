import 'react-native-gesture-handler/jestSetup';

jest.mock('@shopify/react-native-skia', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const reactNative = jest.requireActual('react-native');
  const component = ({ children, ...props }: Record<string, unknown>) =>
    react.createElement(reactNative.View, props, children as never);
  const createPathBuilder = () => {
    const builder = {
      build: () => '',
      close: () => builder,
      lineTo: () => builder,
      moveTo: () => builder,
    };
    return builder;
  };
  return {
    __esModule: true,
    Canvas: component,
    Circle: component,
    DashPathEffect: component,
    Fill: component,
    Group: component,
    ImageShader: component,
    Oval: component,
    Path: component,
    Skia: { PathBuilder: { Make: createPathBuilder } },
    Text: component,
    Vertices: component,
    matchFont: ({ fontSize = 12 }: { fontSize?: number }) => ({
      getSize: () => fontSize,
      measureText: (text: string) => ({ width: text.length * fontSize * 0.6 }),
    }),
    useImage: () => null,
    vec: (x: number, y: number) => ({ x, y }),
  };
});

jest.mock('react-native-reanimated', () => {
  const reactNative = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: reactNative.View },
    runOnJS: (callback: (...parameters: unknown[]) => unknown) => callback,
    useDerivedValue: (factory: () => unknown) => ({
      get value() {
        return factory();
      },
    }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (initialValue: unknown) => {
      const sharedValue = {
        value: initialValue,
        get: () => sharedValue.value,
        set: (value: unknown) => {
          sharedValue.value = value;
        },
      };
      return sharedValue;
    },
  };
});
