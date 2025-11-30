import React, { useRef, useEffect, useState } from 'react';
import Moveable from 'react-moveable';

const TextOverlayLayer = ({
    textLayers,
    selectedId,
    onUpdate,
    onSelect,
    currentTime,
    containerRef
}) => {
    const targetRef = useRef(null);
    const currentRotationRef = useRef(0);
    const [isEditing, setIsEditing] = useState(false);

    // Filter visible layers based on current time
    const visibleLayers = textLayers.filter(layer =>
        currentTime >= layer.timing.start && currentTime <= layer.timing.end
    );

    const selectedLayer = textLayers.find(l => l.id === selectedId);
    const isSelectedVisible = selectedLayer && visibleLayers.some(l => l.id === selectedId);

    const handleTextChange = (e, id) => {
        onUpdate(id, { text: e.target.innerText });
    };

    return (
        <div className="text-overlay-layer" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // Allow clicks to pass through to video if not hitting text
            zIndex: 30
        }}>
            {visibleLayers.map(layer => (
                layer.type === 'image' ? (
                    <img
                        key={layer.id}
                        id={`text-layer-${layer.id}`}
                        src={layer.src}
                        className={`text-element`}
                        alt="drawing"
                        style={{
                            position: 'absolute',
                            left: `${layer.transform.x}px`,
                            top: `${layer.transform.y}px`,
                            width: 'auto',
                            height: 'auto',
                            pointerEvents: 'auto', // Enable clicking
                            userSelect: 'none',
                            cursor: 'pointer', // Show pointer to indicate selectability
                            filter: selectedId === layer.id ? 'drop-shadow(0 0 2px #3b82f6) drop-shadow(0 0 2px #3b82f6)' : 'none', // Blue glow outline
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(layer.id);
                        }}
                        draggable={false}
                    />
                ) : (
                    <div
                        key={layer.id}
                        id={`text-layer-${layer.id}`}
                        className={`text-element ${selectedId === layer.id ? 'selected' : ''}`}
                        style={{
                            position: 'absolute',
                            left: `${layer.transform.x}px`,
                            top: `${layer.transform.y}px`,
                            width: 'max-content',
                            transform: `rotate(${layer.transform.rotate}deg) scale(${layer.transform.scale[0]}, ${layer.transform.scale[1]})`,
                            whiteSpace: 'pre-wrap',
                            // transformOrigin removed to default to center
                            ...layer.style,
                            pointerEvents: 'auto', // Re-enable pointer events for text
                            cursor: 'move',
                            border: selectedId === layer.id ? '1px dashed #3b82f6' : '1px dashed transparent',
                            padding: '4px'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(layer.id);
                        }}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                        contentEditable={isEditing && selectedId === layer.id}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                            setIsEditing(false);
                            handleTextChange(e, layer.id);
                        }}
                    >
                        {layer.text}
                    </div>
                )
            ))}

            {isSelectedVisible && !isEditing && selectedLayer?.type !== 'image' && (
                <Moveable
                    target={document.getElementById(`text-layer-${selectedId}`)}
                    className="moveable-control-box"
                    draggable={true}
                    throttleDrag={0}
                    scalable={true}
                    keepRatio={true}
                    throttleScale={0}
                    rotatable={true}
                    throttleRotate={0}
                    rotation={selectedLayer.transform.rotate}
                    origin={true}

                    onDrag={({ target, left, top }) => {
                        target.style.left = `${left}px`;
                        target.style.top = `${top}px`;
                    }}
                    onDragEnd={({ target }) => {
                        const rect = target.getBoundingClientRect();
                        const containerRect = containerRef.current.getBoundingClientRect();
                        onUpdate(selectedId, {
                            transform: {
                                ...selectedLayer.transform,
                                x: parseFloat(target.style.left),
                                y: parseFloat(target.style.top),
                            }
                        });
                    }}

                    onScale={({ target, drag }) => {
                        target.style.transform = drag.transform;
                    }}
                    onScaleEnd={({ lastEvent }) => {
                        if (lastEvent) {
                            const { drag, scale } = lastEvent;
                            const [tx, ty] = drag.beforeTranslate;

                            onUpdate(selectedId, {
                                transform: {
                                    ...selectedLayer.transform,
                                    x: selectedLayer.transform.x + tx,
                                    y: selectedLayer.transform.y + ty,
                                    scale: scale
                                }
                            });
                        }
                    }}

                    onRotate={({ target, rotation }) => {
                        target.style.transform = `rotate(${rotation}deg) scale(${selectedLayer.transform.scale[0]}, ${selectedLayer.transform.scale[1]})`;
                        currentRotationRef.current = rotation;
                    }}
                    onRotateEnd={({ target }) => {
                        // Use the rotation value stored in the ref
                        onUpdate(selectedId, {
                            transform: {
                                ...selectedLayer.transform,
                                rotate: currentRotationRef.current
                            }
                        });
                    }}
                />
            )}
        </div>
    );
};

export default TextOverlayLayer;
