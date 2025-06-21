'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'
import '@tensorflow/tfjs-backend-webgl'

// Define Keypoint type since we're avoiding the Pose import
type Keypoint = {
  name: string
  score: number
  x: number
  y: number
}

const LivePosture = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [feedback, setFeedback] = useState('Initializing...')

  useEffect(() => {
    let detector: poseDetection.PoseDetector
    let stream: MediaStream

    const initialize = async () => {
      try {
        // 1. Setup camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // 2. Load model
        await tf.setBackend('webgl')
        detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        )

        // 3. Start detection loop
        detectPose(detector)
      } catch (err) {
        console.error('Initialization failed:', err)
        setFeedback('Initialization failed. Please refresh.')
      }
    }

    const detectPose = async (detector: poseDetection.PoseDetector) => {
      if (!videoRef.current) return

      try {
        const poses = await detector.estimatePoses(videoRef.current)
        if (poses.length > 0) {
          const keypoints = poses[0].keypoints as unknown as Keypoint[]
          evaluatePosture(keypoints)
        }
        requestAnimationFrame(() => detectPose(detector))
      } catch (err) {
        console.error('Detection error:', err)
      }
    }

    const evaluatePosture = (keypoints: Keypoint[]) => {
      const left = keypoints.find(p => p.name === 'left_shoulder')
      const right = keypoints.find(p => p.name === 'right_shoulder')

      if (!left || !right || left.score < 0.3 || right.score < 0.3) {
        setFeedback('Shoulders not visible. Adjust camera.')
        return
      }

      const shoulderDiff = Math.abs(left.y - right.y)
      setFeedback(
        shoulderDiff > 30
          ? 'Sit/stand upright. Keep your shoulders level.'
          : 'Good posture!'
      )
    }

    initialize()

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop())
      if (detector) detector.dispose()
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Posture Check</h1>
      <video
        ref={videoRef}
        className="border rounded-lg w-full max-w-md"
        autoPlay
        playsInline
        muted
      />
      <p className="mt-4 text-lg font-medium">{feedback}</p>
    </div>
  )
}

export default LivePosture