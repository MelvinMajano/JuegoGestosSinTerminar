import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from 'react-native';
import { Appbar, Provider as PaperProvider } from 'react-native-paper';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

const { width, height } = Dimensions.get('window');
const ballDiameter = 20;
const barWidth = 100;
const barHeight = 20;
const blockWidth = 50;
const blockHeight = 20;
const blockSpacing = 10;
const barYPosition = height - 280;
const cameraHeight = 160;
const blockStartY = cameraHeight - 150;
const ballStartY = (height - cameraHeight) / 2 - ballDiameter / 2;

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [ballPosition, setBallPosition] = useState({ x: width / 2 - ballDiameter / 2, y: ballStartY });
  const [ballVelocity, setBallVelocity] = useState({ vx: 3, vy: 3 });
  const [blocks, setBlocks] = useState(generateBlocks());
  const barPositionRef = useRef(width / 2 - barWidth / 2);

  // Configurar y cargar el modelo de Handpose
  useEffect(() => {
    async function loadHandposeModel() {
      await tf.ready();
      const model = await handpose.load();
      detectHand(model);
    }

    async function detectHand(model) {
      if (!cameraRef.current) return;
      const predictions = await model.estimateHands(cameraRef.current);
      if (predictions.length > 0) {
        const hand = predictions[0];
        const indexTip = hand.landmarks[8];
        const indexFingerX = indexTip[0];
        const touchX = (indexFingerX / cameraRef.current.videoWidth) * width - barWidth / 2;
        const newBarPosition = Math.max(0, Math.min(touchX, width - barWidth));
        barPositionRef.current = newBarPosition;
      }
      requestAnimationFrame(() => detectHand(model));
    }

    loadHandposeModel();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setBallPosition(prev => {
        let newX = prev.x + ballVelocity.vx;
        let newY = prev.y + ballVelocity.vy;

        if (newX <= 0 || newX >= width - ballDiameter) {
          setBallVelocity(v => ({ ...v, vx: -v.vx }));
        }
        if (newY <= blockStartY || newY >= height - ballDiameter) {
          setBallVelocity(v => ({ ...v, vy: -v.vy }));
        }

        const barPosition = barPositionRef.current;
        if (newY + ballDiameter >= barYPosition &&
          newY + ballDiameter <= barYPosition + barHeight &&
          newX + ballDiameter >= barPosition &&
          newX <= barPosition + barWidth) {
          setBallVelocity(v => ({ ...v, vy: -v.vy }));
        }

        setBlocks(prevBlocks => {
          return prevBlocks.filter(block => {
            const hit = newX + ballDiameter >= block.x &&
              newX <= block.x + blockWidth &&
              newY + ballDiameter >= block.y &&
              newY <= block.y + blockHeight;
            if (hit) {
              setBallVelocity(v => ({ ...v, vy: -v.vy }));
            }
            return !hit;
          });
        });

        if (newY >= height - ballDiameter) {
          newX = width / 2 - ballDiameter / 2;
          newY = ballStartY;
          setBallVelocity({ vx: 3, vy: 3 });
        }

        return { x: newX, y: newY };
      });
    }, 16);

    return () => {
      clearInterval(interval);
    };
  }, [ballVelocity]);

  function generateBlocks() {
    const rows = 5;
    const cols = Math.floor((width - blockSpacing) / (blockWidth + blockSpacing));
    let blocksArray = [];
    const offsetX = (width - (cols * (blockWidth + blockSpacing) - blockSpacing)) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * (blockWidth + blockSpacing);
        const y = blockStartY + row * (blockHeight + blockSpacing);
        blocksArray.push({ x, y });
      }
    }
    return blocksArray;
  }

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>La aplicación necesita acceso a la cámara</Text>
        <Button onPress={requestPermission} title="Conceder Permiso" />
      </View>
    );
  }

  return (
    <PaperProvider>
      <Appbar.Header>
        <Appbar.Content title="Brick Breaker" />
      </Appbar.Header>
      <View style={styles.container}>
        <CameraView style={styles.camera} facing='front' ref={cameraRef}>
          <View style={styles.buttonContainer}>
          </View>
        </CameraView>
        <View style={styles.gameContainer}>
          {blocks.map((block, index) => (
            <View key={index} style={[styles.block, { left: block.x, top: block.y }]} />
          ))}
          <View style={[styles.ball, { left: ballPosition.x, top: ballPosition.y }]} />
          <View style={[styles.bar, { left: barPositionRef.current, top: barYPosition }]} />
        </View>
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  camera: {
    width: '100%',
    height: cameraHeight,
  },
  buttonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    margin: 20,
  },
  text: {
    fontSize: 18,
    color: 'white',
  },
  gameContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  ball: {
    width: ballDiameter,
    height: ballDiameter,
    borderRadius: ballDiameter / 2,
    backgroundColor: 'red',
    position: 'absolute',
  },
  bar: {
    width: barWidth,
    height: barHeight,
    backgroundColor: 'white',
    position: 'absolute',
  },
  block: {
    width: blockWidth,
    height: blockHeight,
    backgroundColor: 'yellow',
    position: 'absolute',
  },
});
