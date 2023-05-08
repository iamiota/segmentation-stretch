import * as cornerstone from '@cornerstonejs/core'
import * as cornerstoneTools from '@cornerstonejs/tools'

import {
  createImageIdsAndCacheMetaData,
  toolGroupId,
  volumeLoaderScheme,
} from '@/utils/cornerstone'

export type ColorLUT = Array<[number, number, number, number]>

const { Enums: csToolsEnums, segmentation } = cornerstoneTools
const { volumeLoader, cache } = cornerstone
const { SegmentationRepresentations } = csToolsEnums

const fillSegmentation = async (
  volumeId: string,
  segmentationVolume: cornerstone.ImageVolume
) => {
  const imageIds = (await createImageIdsAndCacheMetaData(
    `nifti:resources/niis/base.nii`
  )) as Array<string>

  const imageKey = `nifti:${volumeId}#z-0,t-0`
  const isCached = cache._imageCache.get(imageKey)

  const volume = isCached
    ? await volumeLoader.loadVolume(volumeId)
    : await volumeLoader.createAndCacheVolume(volumeId, {
        imageIds,
      })

  await volume.load()

  const { scalarData } = segmentationVolume

  let voxelIndex = 0
  const zIndexLen = volume.dimensions[2]
  const yIndexLen = volume.dimensions[0]
  const xIndexLen = volume.dimensions[1]

  for (let z = 0; z < zIndexLen; z++) {
    for (let y = 0; y < yIndexLen; y++) {
      for (let x = 0; x < xIndexLen; x++) {
        if (volume.scalarData[voxelIndex]) {
          scalarData[voxelIndex] = volume.scalarData[voxelIndex]
        }
        voxelIndex++
      }
    }
  }
}

export const addSegmentation = async (
  volumeId: string,
  segmentationId: string,
  index: number
) => {
  const segmentationVolume = await volumeLoader.createAndCacheDerivedVolume(
    volumeId,
    {
      volumeId: segmentationId,
    }
  )

  segmentation.addSegmentations([
    {
      segmentationId: segmentationId,
      representation: {
        type: SegmentationRepresentations.Labelmap,
        data: {
          volumeId: segmentationId,
        },
      },
    },
  ])

  await fillSegmentation(volumeId, segmentationVolume)

  const [segmentationRepresentationUID] =
    await segmentation.addSegmentationRepresentations(toolGroupId, [
      {
        segmentationId: segmentationId,
        type: SegmentationRepresentations.Labelmap,
      },
    ])

  segmentation.config.color.addColorLUT(
    [
      [0, 0, 0, 0],
      [255, 213, 166, 255],
    ],
    index
  )
  segmentation.config.color.setColorLUT(
    toolGroupId,
    segmentationRepresentationUID,
    index
  )
  return segmentationRepresentationUID
}

export interface SegmentationItem {
  id: string
  path: string
}

export const loadSegmentationsWithViewports = async (
  segmentations: Array<SegmentationItem>
) => {
  for (let i = 0; i < segmentations.length; i++) {
    const segmentation = segmentations[i]
    const volumeId = `${volumeLoaderScheme}:${segmentation.id}`

    try {
      const imageIds = (await createImageIdsAndCacheMetaData(
        `nifti:${segmentation!.path}`
      )) as Array<string>

      const imageKey = `nifti:${volumeId}#z-0,t-0`
      const isCached = cache._imageCache.get(imageKey)

      if (!isCached) {
        const volume = await volumeLoader.createAndCacheVolume(volumeId, {
          imageIds,
        })

        volume.load()
        volume.metadata.FrameOfReferenceUID = 'ALLOW_LOADING_DIFFENT_VOLUMES'
      }
    } catch (e) {
      console.warn('loadVolume', e)
    }

    try {
      await addSegmentation(volumeId, segmentation.id, i)
    } catch (e) {
      console.warn(e)
    }
  }
}
