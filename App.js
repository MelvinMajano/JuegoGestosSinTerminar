import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, Button } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';
import { Appbar, Provider as PaperProvider } from 'react-native-paper';

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

function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const webViewRef = useRef(null);
  const [ballPosition, setBallPosition] = useState({ x: width / 2 - ballDiameter / 2, y: ballStartY });
  const [ballVelocity, setBallVelocity] = useState({ vx: 3, vy: 3 });
  const [blocks, setBlocks] = useState(generateBlocks());
  const [barPosition, setBarPosition] = useState(width / 2 - barWidth / 2);
  const barPositionRef = useRef(barPosition);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleWebViewMessage = (event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'log') {
      console.log(data.message);
    } else if (data.type === 'position') {
      barPositionRef.current = parseFloat(data.message);
      setBarPosition(barPositionRef.current);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setBallPosition((prev) => {
        let newX = prev.x + ballVelocity.vx;
        let newY = prev.y + ballVelocity.vy;

        if (newX <= 0 || newX >= width - ballDiameter) {
          setBallVelocity((v) => ({ ...v, vx: -v.vx }));
        }
        if (newY <= blockStartY || newY >= height - ballDiameter) {
          setBallVelocity((v) => ({ ...v, vy: -v.vy }));
        }

        const barPosition = barPositionRef.current;
        if (
          newY + ballDiameter >= barYPosition &&
          newY + ballDiameter <= barYPosition + barHeight &&
          newX + ballDiameter >= barPosition &&
          newX <= barPosition + barWidth
        ) {
          setBallVelocity((v) => ({ ...v, vy: -v.vy }));
        }

        setBlocks((prevBlocks) => {
          return prevBlocks.filter((block) => {
            const hit =
              newX + ballDiameter >= block.x &&
              newX <= block.x + blockWidth &&
              newY + ballDiameter >= block.y &&
              newY <= block.y + blockHeight;
            if (hit) {
              setBallVelocity((v) => ({ ...v, vy: -v.vy }));
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

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text>La aplicación necesita acceso a la cámara</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, styles.centered]}>
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
        <CameraView style={styles.camera} facing="front" ref={cameraRef} />
        <WebView
          ref={webViewRef}
          style={styles.webview}
          javaScriptEnabled={true}
          source={{
            html: `
              <video autoplay playsinline muted></video>
              <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
              <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose"></script>
              <script>
                console.log = function(message) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message }));
                };

                console.log('WebView script started');

                async function setupCamera() {
                  const video = document.querySelector('video');
                  if (video) {
                    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                      video.srcObject = stream;
                      console.log('Stream started');
                      video.addEventListener('loadeddata', () => {
                        console.log('Video data loaded');
                      });
                    }).catch(error => {
                      console.log('Error accessing camera:', error);
                    });
                  }
                }

                async function detectHand(model) {
                  const video = document.querySelector('video');
                  if (!video) {
                    console.log('No video element found');
                    return;
                  }

                  requestAnimationFrame(() => detectHand(model));

                  const predictions = await model.estimateHands(video);
                  console.log('Predictions:', predictions);

                  if (predictions.length > 0) {
                    const hand = predictions[0];
                    const indexTip = hand.landmarks[8];
                    const indexFingerX = indexTip[0];
                    const touchX = (indexFingerX / video.videoWidth) * ${width} - ${barWidth} / 2;
                    const newBarPosition = Math.max(0, Math.min(touchX, ${width} - ${barWidth}));
                    console.log('New bar position:', newBarPosition);
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'position', message: newBarPosition }));
                  } else {
                    console.log('No hand detected');
                  }
                }

                async function loadHandpose() {
                  console.log('Loading Handpose model');
                  await tf.ready();
                  const model = await handpose.load();
                  detectHand(model);
                  console.log('Handpose model loaded');
                }

                loadHandpose();
              </script>
            `,
          }}
          onMessage={handleWebViewMessage}
        />
        <View style={styles.gameContainer}>
          {blocks.map((block, index) => (
            <View key={index} style={[styles.block, { left: block.x, top: block.y }]} />
          ))}
          <View style={[styles.ball, { left: ballPosition.x, top: ballPosition.y }]} />
          <View style={[styles.bar, { left: barPosition, top: barYPosition }]} />
        </View>
      </View>
    </PaperProvider>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    width: '100%',
    height: cameraHeight,
  },
  webview: {
    width: '100%',
    height: cameraHeight,
  },
  gameContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'absolute',
    top: cameraHeight,
    width: '100%',
    height: height - cameraHeight,
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
  message: {
    fontSize: 18,
    textAlign: 'center',
  },
});

export default App;
