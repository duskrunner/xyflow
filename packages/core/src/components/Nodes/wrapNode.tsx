import React, { useEffect, useRef, memo } from 'react';
import type { ComponentType, KeyboardEvent } from 'react';
import cc from 'classcat';

import { useStoreApi } from '../../hooks/useStore';
import { Provider } from '../../contexts/NodeIdContext';
import { ARIA_NODE_DESC_KEY } from '../A11yDescriptions';
import useDrag from '../../hooks/useDrag';
import useUpdateNodePositions from '../../hooks/useUpdateNodePositions';
import { handleNodeClick } from './utils';
import { dataToAttribute, elementSelectionKeys, isInputDOMNode } from '../../utils';
import type { NodeProps, WrapNodeProps, XYPosition } from '../../types';

export const arrowKeyDiffs: Record<string, XYPosition> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export default (NodeComponent: ComponentType<NodeProps>) => {
  const NodeWrapper = ({
    id,
    type,
    data,
    xPos,
    yPos,
    xPosOrigin,
    yPosOrigin,
    selected,
    style,
    className,
    isDraggable,
    isSelectable,
    isConnectable,
    isFocusable,
    selectNodesOnDrag,
    sourcePosition,
    targetPosition,
    hidden,
    resizeObserver,
    dragHandle,
    zIndex,
    isParent,
    noDragClassName,
    noPanClassName,
    initialized,
    disableKeyboardA11y,
    ariaLabel,
    rfId,
  }: WrapNodeProps) => {
    const store = useStoreApi();
    const nodeRef = useRef<HTMLDivElement>(null);
    const prevSourcePosition = useRef(sourcePosition);
    const prevTargetPosition = useRef(targetPosition);
    const prevType = useRef(type);
    const hasPointerEvents = isSelectable || isDraggable;
    const updatePositions = useUpdateNodePositions();

    const onKeyDown = (event: KeyboardEvent) => {
      if (isInputDOMNode(event)) {
        return;
      }

      if (elementSelectionKeys.includes(event.key) && isSelectable) {
        const unselect = event.key === 'Escape';

        handleNodeClick({
          id,
          store,
          unselect,
          nodeRef,
        });
      } else if (
        !disableKeyboardA11y &&
        isDraggable &&
        selected &&
        Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)
      ) {
        store.setState({
          ariaLiveMessage: `Moved selected node ${event.key
            .replace('Arrow', '')
            .toLowerCase()}. New position, x: ${~~xPos}, y: ${~~yPos}`,
        });

        updatePositions({
          x: arrowKeyDiffs[event.key].x,
          y: arrowKeyDiffs[event.key].y,
          isShiftPressed: event.shiftKey,
        });
      }
    };

    useEffect(() => {
      if (nodeRef.current && !hidden) {
        const currNode = nodeRef.current;
        resizeObserver?.observe(currNode);

        return () => resizeObserver?.unobserve(currNode);
      }
    }, [hidden]);

    useEffect(() => {
      // when the user programmatically changes the source or handle position, we re-initialize the node
      const typeChanged = prevType.current !== type;
      const sourcePosChanged = prevSourcePosition.current !== sourcePosition;
      const targetPosChanged = prevTargetPosition.current !== targetPosition;

      if (nodeRef.current && (typeChanged || sourcePosChanged || targetPosChanged)) {
        if (typeChanged) {
          prevType.current = type;
        }
        if (sourcePosChanged) {
          prevSourcePosition.current = sourcePosition;
        }
        if (targetPosChanged) {
          prevTargetPosition.current = targetPosition;
        }
        store.getState().updateNodeDimensions([{ id, nodeElement: nodeRef.current, forceUpdate: true }]);
      }
    }, [id, type, sourcePosition, targetPosition]);

    const dragging = useDrag({
      nodeRef,
      disabled: hidden || !isDraggable,
      noDragClassName,
      handleSelector: dragHandle,
      nodeId: id,
      isSelectable,
      selectNodesOnDrag,
    });

    if (hidden) {
      return null;
    }

    const node = store.getState().nodeInternals.get(id);
    const nodeDataProps = dataToAttribute(node, 'node');

    return (
      <div
        className={cc([
          'react-flow__node',
          `react-flow__node-${type}`,
          {
            // this is overwritable by passing `nopan` as a class name
            [noPanClassName]: isDraggable,
          },
          className,
          {
            selected,
            selectable: isSelectable,
            parent: isParent,
            dragging,
          },
        ])}
        ref={nodeRef}
        style={{
          zIndex,
          transform: `translate(${xPosOrigin}px,${yPosOrigin}px)`,
          pointerEvents: hasPointerEvents ? 'all' : 'none',
          visibility: initialized ? 'visible' : 'hidden',
          ...style,
        }}
        data-id={id}
        data-testid={`rf__node-${id}`}
        onKeyDown={isFocusable ? onKeyDown : undefined}
        tabIndex={isFocusable ? 0 : undefined}
        role={isFocusable ? 'button' : undefined}
        aria-describedby={disableKeyboardA11y ? undefined : `${ARIA_NODE_DESC_KEY}-${rfId}`}
        aria-label={ariaLabel}
        data-nodedata={nodeDataProps}
        data-eltype="node"
      >
        <Provider value={id}>
          <NodeComponent
            id={id}
            data={data}
            type={type}
            xPos={xPos}
            yPos={yPos}
            selected={selected}
            isConnectable={isConnectable}
            sourcePosition={sourcePosition}
            targetPosition={targetPosition}
            dragging={dragging}
            dragHandle={dragHandle}
            zIndex={zIndex}
          />
        </Provider>
      </div>
    );
  };

  NodeWrapper.displayName = 'NodeWrapper';

  return memo(NodeWrapper);
};
