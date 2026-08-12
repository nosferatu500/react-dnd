export interface Row {
	id: number
	name: string
}

/** What a drag of one or more rows carries. */
export interface RowDragItem {
	ids: number[]
}
