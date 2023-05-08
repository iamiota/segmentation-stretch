import { useState, useEffect, useRef } from 'react'

import {
  cornerstoneInit,
  loadVolumeWithViewports,
  loadSegmentationsWithViewports,
} from '@/utils/cornerstone'

const App = () => {
  const [init, setInit] = useState(false)
  const dom = useRef(null)
  const viewportId = 'viewport3D'

  const handleAddSegmentation = () => {
    loadSegmentationsWithViewports([
      {
        id: 'segmentation',
        path: 'resources/niis/bone.nii',
      },
    ])
  }

  useEffect(() => {
    const initCornerstone = async () => {
      await cornerstoneInit()
      setInit(true)
    }
    initCornerstone()
  }, [])

  useEffect(() => {
    if (!init) return
    loadVolumeWithViewports(
      { id: 'volume', path: 'resources/niis/base.nii' },
      viewportId
    )
  }, [init])

  if (!init) return null

  return (
    <>
      <button onClick={handleAddSegmentation}>add segmentation</button>
      <br />
      <br />
      <div
        ref={dom}
        id={viewportId}
        style={{ width: '500px', height: '500px' }}
      />
    </>
  )
}

export default App
