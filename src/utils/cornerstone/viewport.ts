import * as cornerstone from '@cornerstonejs/core'
import * as cornerstoneNIFTIImageLoader from 'cornerstone-nifti-image-loader'
import * as cornerstoneTools from '@cornerstonejs/tools'
import {
  cornerstoneStreamingImageVolumeLoader,
  cornerstoneStreamingDynamicImageVolumeLoader,
} from '@cornerstonejs/streaming-image-volume-loader'

type CornerstoneStreamingImageVolumeLoaderParams = [
  string,
  {
    imageIds: string[]
  }
]

const { volumeLoader, cache, setVolumesForViewports } = cornerstone
const {
  ToolGroupManager,
  SegmentationDisplayTool,
  TrackballRotateTool,
} = cornerstoneTools

export const volumeLoaderScheme = 'cornerstoneStreamingImageVolume'

export const createImageIdsAndCacheMetaData = async (imageId: string) => {
  const colonIndex = imageId.indexOf(':')
  const scheme = imageId.substring(0, colonIndex)
  if (scheme !== 'nifti') {
    console.warn(
      'createImageIdsAndCacheMetaData: imageId must have scheme "nifti". imageId: ',
      imageId
    )
    return
  }

  const imageIdObject =
    cornerstoneNIFTIImageLoader.nifti.ImageId.fromURL(imageId)
  const image = await cornerstone.imageLoader.loadAndCacheImage(
    imageIdObject.url
  )


  const { numberOfFrames } = cornerstone.metaData.get(
    'multiFrame',
    image.imageId
  )
  const imageIds = Array.from(
    Array(numberOfFrames),
    (_, i) =>
      `nifti:${imageIdObject.filePath}#${imageIdObject.slice.dimension}-${i},t-0`
  )

  for (let i = 0; i < imageIds.length; i++) {
    const imageIdObject = cornerstoneNIFTIImageLoader.nifti.ImageId.fromURL(
      imageIds[i]
    )
    await cornerstone.imageLoader.loadAndCacheImage(imageIdObject.url)
  }

  return imageIds
}

const initVolumeLoader = () => {
  volumeLoader.registerUnknownVolumeLoader((...params) =>
    cornerstoneStreamingImageVolumeLoader(
      ...(params as CornerstoneStreamingImageVolumeLoaderParams)
    )
  )
  volumeLoader.registerVolumeLoader(
    'cornerstoneStreamingImageVolume',
    (...params) =>
      cornerstoneStreamingImageVolumeLoader(
        ...(params as CornerstoneStreamingImageVolumeLoaderParams)
      )
  )
  volumeLoader.registerVolumeLoader(
    'cornerstoneStreamingDynamicImageVolume',
    (...params) =>
      cornerstoneStreamingDynamicImageVolumeLoader(
        ...(params as CornerstoneStreamingImageVolumeLoaderParams)
      )
  )
}

export const renderingEngineId = 'TheRenderEngine'
export const toolGroupId = 'toolGroup'
let toolGroup: cornerstoneTools.Types.IToolGroup
let renderingEngine: cornerstone.RenderingEngine

export const cornerstoneInit = async () => {
  await cornerstone.init()

  initVolumeLoader()

  cornerstoneNIFTIImageLoader.external.cornerstone = cornerstone

  cornerstoneNIFTIImageLoader.nifti.register(cornerstone)

  cornerstoneTools.init()
  renderingEngine = new cornerstone.RenderingEngine(renderingEngineId)

  cornerstoneTools.addTool(SegmentationDisplayTool)
  cornerstoneTools.addTool(TrackballRotateTool)

  toolGroup = ToolGroupManager.createToolGroup(toolGroupId)!
  toolGroup.addTool(SegmentationDisplayTool.toolName)
  toolGroup.addTool(TrackballRotateTool.toolName)

  toolGroup.setToolEnabled(SegmentationDisplayTool.toolName)
}

export interface VolumeItem {
  id: string
  path: string
}

export const loadVolumeWithViewports = async (
  volume: VolumeItem,
  viewportId: string
) => {
  const volumeId = `${volumeLoaderScheme}:${volume.id}`
  try {
    const imageIds = (await createImageIdsAndCacheMetaData(
      `nifti:${volume.path}`
    )) as Array<string>

    const imageKey = `nifti:${volumeId}#z-0,t-0`
    const isCached = cache._imageCache.get(imageKey)
    if (!isCached) {
      const volume = await volumeLoader.createAndCacheVolume(volumeId, {
        imageIds,
      })

      await volume.load()
      volume.metadata.FrameOfReferenceUID = 'ALLOW_LOADING_DIFFERENT_VOLUMES'
    }
  } catch (e) {
    console.warn('loadVolume', e)
  }

  renderingEngine.setViewports([
    {
      viewportId,
      type: cornerstone.Enums.ViewportType.VOLUME_3D,
      element: document.querySelector(`#${viewportId}`)!,
      defaultOptions: {
        background: [0, 0, 0],
      },
    },
  ])
  toolGroup.addViewport(viewportId, renderingEngineId)
  toolGroup.addTool(TrackballRotateTool.toolName, {
    configuration: { volumeId },
  })
  toolGroup.setToolActive(TrackballRotateTool.toolName, {
    bindings: [
      {
        mouseButton: cornerstoneTools.Enums.MouseBindings.Primary,
      },
    ],
  })
  renderingEngine.renderViewports([viewportId])

  await setVolumesForViewports(
    renderingEngine,
    [
      {
        volumeId,
      },
    ],
    [viewportId]
  )

  const viewport3d = renderingEngine.getViewport(viewportId)
  const volumeActor = viewport3d.getDefaultActor()
    .actor as cornerstone.Types.VolumeActor
  cornerstone.utilities.applyPreset(
    volumeActor,
    cornerstone.CONSTANTS.VIEWPORT_PRESETS.find(
      (preset) => preset.name === 'MR-Default'
    )!
  )

  const renderer = viewport3d.getRenderer()
  renderer.getActiveCamera().elevation(-70)

  renderingEngine.render()
}
