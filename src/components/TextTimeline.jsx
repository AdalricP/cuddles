import React, { useRef, useState } from 'react';

const TextTimeline = ({ textLayers, videoDuration, onUpdate, selectedId, onSelect }) => {
    const trackRef = useRef(null);
    const [draggingId, setDraggingId] = useState(null);
    const [resizingId, setResizingId] = useState(null);
    const [resizeEdge, setResizeEdge] = useState(null); // 'start' or 'end'

    const getTimeFromX = (x) => {
        if (!trackRef.current || !videoDuration) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        return percentage * videoDuration;
    };

    const handleMouseDown = (e, id) => {
        e.stopPropagation();
        setDraggingId(id);
        onSelect(id);
    };

    const handleResizeStart = (e, id, edge) => {
        e.stopPropagation();
        setResizingId(id);
        setResizeEdge(edge);
        onSelect(id);
    };

    const handleMouseMove = (e) => {
        if (draggingId) {
            const layer = textLayers.find(l => l.id === draggingId);
            if (!layer) return;

            const newTime = getTimeFromX(e.clientX);
            const duration = layer.timing.end - layer.timing.start;

            // Calculate new start time, keeping duration constant
            // But we need to offset based on where we clicked? 
            // For simplicity, let's just snap center or start to mouse for now, 
            // or better: calculate delta. But delta requires previous mouse pos.
            // Let's just set start time based on mouse pos for now (centering it is better UX but harder without state)
            // Actually, let's just use the current mouse time as the new start time (clamped)

            let newStart = newTime - (duration / 2);
            if (newStart < 0) newStart = 0;
            if (newStart + duration > videoDuration) newStart = videoDuration - duration;

            onUpdate(draggingId, {
                timing: {
                    start: newStart,
                    end: newStart + duration
                }
            });
        } else if (resizingId) {
            const layer = textLayers.find(l => l.id === resizingId);
            if (!layer) return;

            const newTime = getTimeFromX(e.clientX);

            if (resizeEdge === 'start') {
                if (newTime < layer.timing.end - 0.5 && newTime >= 0) {
                    onUpdate(resizingId, {
                        timing: { ...layer.timing, start: newTime }
                    });
                }
            } else {
                if (newTime > layer.timing.start + 0.5 && newTime <= videoDuration) {
                    onUpdate(resizingId, {
                        timing: { ...layer.timing, end: newTime }
                    });
                }
            }
        }
    };

    const handleMouseUp = () => {
        setDraggingId(null);
        setResizingId(null);
        setResizeEdge(null);
    };

    React.useEffect(() => {
        if (draggingId || resizingId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingId, resizingId, textLayers, videoDuration]);

    // Calculate layout rows to avoid overlap
    const getLayerRows = () => {
        const sortedLayers = [...textLayers].sort((a, b) => a.timing.start - b.timing.start);
        const rows = []; // Array of arrays of layers

        sortedLayers.forEach(layer => {
            let placed = false;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const lastLayerInRow = row[row.length - 1];
                // Check if this layer overlaps with the last one in this row
                // Add a small buffer for visual separation
                if (layer.timing.start >= lastLayerInRow.timing.end) {
                    row.push(layer);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                rows.push([layer]);
            }
        });

        // Map layer ID to row index
        const layerRowMap = {};
        rows.forEach((row, index) => {
            row.forEach(layer => {
                layerRowMap[layer.id] = index;
            });
        });

        return { layerRowMap, totalRows: rows.length };
    };

    const { layerRowMap, totalRows } = getLayerRows();
    const rowHeight = 30;
    const gap = 4;
    const totalContentHeight = Math.max(30, totalRows * (rowHeight + gap));
    const fixedContainerHeight = 120; // Reduced height as requested

    return (
        <div className="text-timeline-container" style={{ marginTop: '1rem', width: '100%' }}>
            <div className="text-timeline-header" style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Timeline Layers
            </div>
            <div
                className="text-timeline-track"
                ref={trackRef}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: `${fixedContainerHeight}px`,
                    backgroundColor: '#111',
                    borderRadius: '4px',
                    overflowY: 'auto', // Always allow scrolling if needed
                    overflowX: 'hidden',
                    // transition: 'height 0.2s ease' // Removed transition as height is fixed
                }}
            >
                <div style={{ height: `${Math.max(totalContentHeight, fixedContainerHeight)}px`, width: '100%', position: 'relative' }}>
                    {textLayers.map(layer => {
                        const startPercent = (layer.timing.start / videoDuration) * 100;
                        const durationPercent = ((layer.timing.end - layer.timing.start) / videoDuration) * 100;
                        const isSelected = selectedId === layer.id;
                        const isDrawing = layer.type === 'image';
                        const rowIndex = layerRowMap[layer.id] || 0;

                        return (
                            <div
                                key={layer.id}
                                className={`timeline-bar ${isSelected ? 'selected' : ''}`}
                                style={{
                                    position: 'absolute',
                                    left: `${startPercent}%`,
                                    top: `${rowIndex * (rowHeight + gap)}px`,
                                    width: `${durationPercent}%`,
                                    height: `${rowHeight}px`,
                                    backgroundColor: isSelected
                                        ? 'rgba(59, 130, 246, 0.5)'
                                        : (isDrawing ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.2)'), // Green for drawings
                                    border: isSelected
                                        ? '1px solid #3b82f6'
                                        : (isDrawing ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.3)'),
                                    borderRadius: '4px',
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    transition: 'top 0.2s ease'
                                }}
                                onMouseDown={(e) => handleMouseDown(e, layer.id)}
                            >
                                {/* Resize Handles */}
                                {isSelected && (
                                    <>
                                        <div
                                            className="resize-handle start"
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: '6px',
                                                cursor: 'w-resize',
                                                backgroundColor: 'rgba(255,255,255,0.5)'
                                            }}
                                            onMouseDown={(e) => handleResizeStart(e, layer.id, 'start')}
                                        />
                                        <div
                                            className="resize-handle end"
                                            style={{
                                                position: 'absolute',
                                                right: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: '6px',
                                                cursor: 'e-resize',
                                                backgroundColor: 'rgba(255,255,255,0.5)'
                                            }}
                                            onMouseDown={(e) => handleResizeStart(e, layer.id, 'end')}
                                        />
                                    </>
                                )}
                                <span style={{
                                    position: 'absolute',
                                    left: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '10px',
                                    color: 'white',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: 'calc(100% - 16px)'
                                }}>
                                    {layer.text}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TextTimeline;
