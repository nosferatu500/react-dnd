import { useDragDropManager } from '@nosferatu500/react-dnd'
import type { FC } from 'react'
import { useEffect, useState } from 'react'

export const Profiler: FC = () => {
	const dragDropManager = useDragDropManager()
	const backend = dragDropManager?.getBackend()
	const [key, setKey] = useState(0)

	useEffect(() => {
		const timeout = setTimeout(() => {
			setKey(Math.random())
		}, 100)
		return () => clearTimeout(timeout)
	})

	const profile = backend?.profile() || {}
	const profileElements = Object.keys(profile).map((key) => (
		<li key={key}>
			{key}: {profile[key]}
		</li>
	))

	return (
		<div key={key}>
			<ul>{profileElements}</ul>
		</div>
	)
}
