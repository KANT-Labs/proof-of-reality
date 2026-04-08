import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Dimensions, StyleSheet, View, StatusBar, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import KantickFeature from '../features/KantickFeature';
import KantistFeature from '../features/KantistFeature';

const { width } = Dimensions.get('window');

export const App = () => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    // Hide the splash screen once the root app component has mounted
    BootSplash.hide({ fade: true });
  }, []);

  const onScrollBeginDrag = () => {
    setIsScrolling(true);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    setActiveIndex(Math.round(offsetX / width));
    setIsScrolling(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={styles.scrollView}
      >
        <KantickFeature isFocused={activeIndex === 0} isScrolling={isScrolling} />
        <KantistFeature isFocused={activeIndex === 1} isScrolling={isScrolling} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
});

export default App;