import React, { forwardRef, type CSSProperties, useCallback, useState } from 'react';
import cc from 'classcat';

import { BezierEdge, SmoothStepEdge, StepEdge, StraightEdge, SimpleBezierEdge } from '../../components/Edges';
import DefaultNode from '../../components/Nodes/DefaultNode';
import InputNode from '../../components/Nodes/InputNode';
import OutputNode from '../../components/Nodes/OutputNode';
import GroupNode from '../../components/Nodes/GroupNode';
import SelectionListener from '../../components/SelectionListener';
import StoreUpdater from '../../components/StoreUpdater';
import A11yDescriptions from '../../components/A11yDescriptions';
import GraphView from '../GraphView';
import Wrapper from './Wrapper';
import { infiniteExtent } from '../../store/initialState';
import { ConnectionLineType, ConnectionMode, Edge, PanOnScrollMode, SelectionMode, Node } from '../../types';
import type {
  EdgeMouseHandler,
  EdgeTypes,
  NodeMouseHandler,
  NodeOrigin,
  NodeTypes,
  ReactFlowProps,
  ReactFlowRefType,
  Viewport,
} from '../../types';
import { isMacOs } from '../../utils';

const defaultNodeTypes: NodeTypes = {
  input: InputNode,
  default: DefaultNode,
  output: OutputNode,
  group: GroupNode,
};

const defaultEdgeTypes: EdgeTypes = {
  default: BezierEdge,
  straight: StraightEdge,
  step: StepEdge,
  smoothstep: SmoothStepEdge,
  simplebezier: SimpleBezierEdge,
};

const initNodeOrigin: NodeOrigin = [0, 0];
const initSnapGrid: [number, number] = [15, 15];
const initDefaultViewport: Viewport = { x: 0, y: 0, zoom: 1 };

const wrapperStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 0,
};

const findNodeOrEdge = (node: HTMLElement, listeningEl: HTMLElement): HTMLElement | null => {
  const elType = node?.dataset?.eltype;
  if (elType) return node;

  if (!node.parentElement || node.parentElement === listeningEl) return null;

  return findNodeOrEdge(node.parentElement, listeningEl);
};

const eventHandlersDecorator = (
  nodeCallback: NodeMouseHandler | undefined,
  edgeCallback: EdgeMouseHandler | undefined
) => {
  const decoratedEventHandler = (event: React.MouseEvent<Element, MouseEvent>) => {
    if (!nodeCallback && !edgeCallback) {
      return;
    }
    const data = findNodeOrEdge(event.target, event.currentTarget);

    if (!data) return;

    const elType = data?.dataset?.eltype;

    if (elType == 'node' && nodeCallback !== undefined) {
      if (data.dataset.nodedata) {
        const node = JSON.parse(data.dataset.nodedata);
        nodeCallback(event, node);
      }
    } else if (elType == 'edge' && edgeCallback !== undefined) {
      if (data.dataset.edgedata) {
        const edge = JSON.parse(data.dataset.edgedata);
        edgeCallback(event, edge);
      }
    }
  };
  return decoratedEventHandler;
};

const ReactFlow = forwardRef<ReactFlowRefType, ReactFlowProps>(
  (
    {
      nodes,
      edges,
      defaultNodes,
      defaultEdges,
      className,
      nodeTypes = defaultNodeTypes,
      edgeTypes = defaultEdgeTypes,
      onNodeClick,
      onEdgeClick,
      onInit,
      onMove,
      onMoveStart,
      onMoveEnd,
      onConnect,
      onConnectStart,
      onConnectEnd,
      onClickConnectStart,
      onClickConnectEnd,
      onNodeMouseEnter,
      onNodeMouseMove,
      onNodeMouseLeave,
      onNodeContextMenu,
      onNodeDoubleClick,
      onNodeDragStart,
      onNodeDrag,
      onNodeDragStop,
      onNodesDelete,
      onEdgesDelete,
      onSelectionChange,
      onSelectionDragStart,
      onSelectionDrag,
      onSelectionDragStop,
      onSelectionContextMenu,
      onSelectionStart,
      onSelectionEnd,
      connectionMode = ConnectionMode.Strict,
      connectionLineType = ConnectionLineType.Bezier,
      connectionLineStyle,
      connectionLineComponent,
      connectionLineContainerStyle,
      deleteKeyCode = 'Backspace',
      selectionKeyCode = 'Shift',
      selectionOnDrag = false,
      selectionMode = SelectionMode.Full,
      panActivationKeyCode = 'Space',
      multiSelectionKeyCode = isMacOs() ? 'Meta' : 'Control',
      zoomActivationKeyCode = isMacOs() ? 'Meta' : 'Control',
      snapToGrid = false,
      snapGrid = initSnapGrid,
      onlyRenderVisibleElements = false,
      selectNodesOnDrag = true,
      nodesDraggable,
      nodesConnectable,
      nodesFocusable,
      nodeOrigin = initNodeOrigin,
      edgesFocusable,
      edgesUpdatable,
      elementsSelectable,
      defaultViewport = initDefaultViewport,
      minZoom = 0.5,
      maxZoom = 2,
      translateExtent = infiniteExtent,
      preventScrolling = true,
      nodeExtent,
      defaultMarkerColor = '#b1b1b7',
      zoomOnScroll = true,
      zoomOnPinch = true,
      panOnScroll = false,
      panOnScrollSpeed = 0.5,
      panOnScrollMode = PanOnScrollMode.Free,
      zoomOnDoubleClick = true,
      panOnDrag = true,
      onPaneClick,
      onPaneMouseEnter,
      onPaneMouseMove,
      onPaneMouseLeave,
      onPaneScroll,
      onPaneContextMenu,
      children,
      onEdgeUpdate,
      onEdgeContextMenu,
      onEdgeDoubleClick,
      onEdgeMouseEnter,
      onEdgeMouseMove,
      onEdgeMouseLeave,
      onEdgeUpdateStart,
      onEdgeUpdateEnd,
      edgeUpdaterRadius = 10,
      onNodesChange,
      onEdgesChange,
      noDragClassName = 'nodrag',
      noWheelClassName = 'nowheel',
      noPanClassName = 'nopan',
      fitView = false,
      fitViewOptions,
      connectOnClick = true,
      proOptions,
      defaultEdgeOptions,
      elevateNodesOnSelect = true,
      elevateEdgesOnSelect = false,
      disableKeyboardA11y = false,
      autoPanOnConnect = true,
      autoPanOnNodeDrag = true,
      connectionRadius = 20,
      isValidConnection,
      onError,
      style,
      id,
      nodeDragThreshold,
      onClick,
      ...rest
    },
    ref
  ) => {
    const rfId = id || '1';
    const [currentHovered, setCurrentHovered] = useState<{ elType: null | string; el: null | Node | Edge }>({
      elType: null,
      el: null,
    });

    const hoverEventHandlersDecorator = useCallback(
      (
        nodeEnterCallback: NodeMouseHandler | undefined,
        edgeEnterCallback: EdgeMouseHandler | undefined,
        nodeLeaveCallback: NodeMouseHandler | undefined,
        edgeLeaveCallback: EdgeMouseHandler | undefined
      ) => {
        const decoratedEventHandler = (event: React.MouseEvent<Element, MouseEvent>) => {
          if (!nodeEnterCallback && !edgeEnterCallback) {
            return;
          }
          const data = findNodeOrEdge(event.target, event.currentTarget);

          if (!data) {
            if (edgeLeaveCallback && currentHovered.elType == 'edge') {
              edgeLeaveCallback(event, currentHovered.el as Edge);
              setCurrentHovered({ elType: null, el: null });
            } else if (nodeLeaveCallback && currentHovered.elType == 'node') {
              nodeLeaveCallback(event, currentHovered.el as Node);
              setCurrentHovered({ elType: null, el: null });
            }
            return;
          }

          const elType = data?.dataset?.eltype;
          if (elType == 'node' && nodeEnterCallback !== undefined) {
            if (data.dataset.nodedata) {
              const node = JSON.parse(data.dataset.nodedata);
              if (elType !== currentHovered.elType && edgeLeaveCallback && currentHovered.el) {
                edgeLeaveCallback(event, currentHovered.el as Edge);
              } else if (currentHovered.el && node.id !== currentHovered?.el?.id && nodeLeaveCallback) {
                nodeLeaveCallback(event, currentHovered.el as Node);
              }
              setCurrentHovered({ elType, el: node });
              nodeEnterCallback(event, node);
            }
          } else if (elType == 'edge' && edgeEnterCallback !== undefined) {
            if (data.dataset.edgedata) {
              const edge = JSON.parse(data.dataset.edgedata);
              if (currentHovered.el && elType !== currentHovered.elType && nodeLeaveCallback) {
                nodeLeaveCallback(event, currentHovered.el as Node);
              } else if (currentHovered.el && edge.id !== currentHovered?.el?.id && edgeLeaveCallback) {
                edgeLeaveCallback(event, currentHovered.el as Edge);
              }
              setCurrentHovered({ elType, el: edge });
              edgeEnterCallback(event, edge);
            }
          }
        };
        return decoratedEventHandler;
      },
      [setCurrentHovered, currentHovered]
    );

    const onElClick = useCallback(eventHandlersDecorator(onNodeClick, onEdgeClick), [onNodeClick, onEdgeClick]);
    const onClk = useCallback((event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (onClick) {
        onClick(event)
      }
      onElClick(event)
    }, [onClick, onElClick])
    const onElMouseEnter = useCallback(
      hoverEventHandlersDecorator(onNodeMouseEnter, onEdgeMouseEnter, onNodeMouseLeave, onEdgeMouseLeave),
      [onNodeMouseEnter, onEdgeMouseEnter]
    );
    const onElDoubleClick = useCallback(eventHandlersDecorator(onNodeDoubleClick, onEdgeDoubleClick), [
      onNodeDoubleClick,
      onEdgeDoubleClick,
    ]);
    const onElContextMenu = useCallback(eventHandlersDecorator(onNodeContextMenu, onEdgeContextMenu), [
      onNodeContextMenu,
      onEdgeContextMenu,
    ]);
    const onElMouseMove = useCallback(eventHandlersDecorator(onNodeMouseMove, onEdgeMouseMove), [
      onNodeMouseMove,
      onEdgeMouseMove,
    ]);

    return (
      <div
        {...rest}
        style={{ ...style, ...wrapperStyle }}
        ref={ref}
        className={cc(['react-flow', className])}
        data-testid="rf__wrapper"
        id={id}
        onDoubleClick={onElDoubleClick}
        onContextMenu={onElContextMenu}
        onMouseMove={onElMouseMove}
        onClick={onClk}
        onMouseOver={onElMouseEnter}
      >
        <Wrapper>
          <GraphView
            onInit={onInit}
            onMove={onMove}
            onMoveStart={onMoveStart}
            onMoveEnd={onMoveEnd}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineType={connectionLineType}
            connectionLineStyle={connectionLineStyle}
            connectionLineComponent={connectionLineComponent}
            connectionLineContainerStyle={connectionLineContainerStyle}
            selectionKeyCode={selectionKeyCode}
            selectionOnDrag={selectionOnDrag}
            selectionMode={selectionMode}
            deleteKeyCode={deleteKeyCode}
            multiSelectionKeyCode={multiSelectionKeyCode}
            panActivationKeyCode={panActivationKeyCode}
            zoomActivationKeyCode={zoomActivationKeyCode}
            onlyRenderVisibleElements={onlyRenderVisibleElements}
            selectNodesOnDrag={selectNodesOnDrag}
            defaultViewport={defaultViewport}
            translateExtent={translateExtent}
            minZoom={minZoom}
            maxZoom={maxZoom}
            preventScrolling={preventScrolling}
            zoomOnScroll={zoomOnScroll}
            zoomOnPinch={zoomOnPinch}
            zoomOnDoubleClick={zoomOnDoubleClick}
            panOnScroll={panOnScroll}
            panOnScrollSpeed={panOnScrollSpeed}
            panOnScrollMode={panOnScrollMode}
            panOnDrag={panOnDrag}
            onPaneClick={onPaneClick}
            onPaneMouseEnter={onPaneMouseEnter}
            onPaneMouseMove={onPaneMouseMove}
            onPaneMouseLeave={onPaneMouseLeave}
            onPaneScroll={onPaneScroll}
            onPaneContextMenu={onPaneContextMenu}
            onSelectionContextMenu={onSelectionContextMenu}
            onSelectionStart={onSelectionStart}
            onSelectionEnd={onSelectionEnd}
            onEdgeUpdate={onEdgeUpdate}
            onEdgeUpdateStart={onEdgeUpdateStart}
            onEdgeUpdateEnd={onEdgeUpdateEnd}
            edgeUpdaterRadius={edgeUpdaterRadius}
            defaultMarkerColor={defaultMarkerColor}
            noDragClassName={noDragClassName}
            noWheelClassName={noWheelClassName}
            noPanClassName={noPanClassName}
            elevateEdgesOnSelect={elevateEdgesOnSelect}
            rfId={rfId}
            disableKeyboardA11y={disableKeyboardA11y}
            nodeOrigin={nodeOrigin}
            nodeExtent={nodeExtent}
          />
          <StoreUpdater
            nodes={nodes}
            edges={edges}
            defaultNodes={defaultNodes}
            defaultEdges={defaultEdges}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onClickConnectStart={onClickConnectStart}
            onClickConnectEnd={onClickConnectEnd}
            nodesDraggable={nodesDraggable}
            nodesConnectable={nodesConnectable}
            nodesFocusable={nodesFocusable}
            edgesFocusable={edgesFocusable}
            edgesUpdatable={edgesUpdatable}
            elementsSelectable={elementsSelectable}
            elevateNodesOnSelect={elevateNodesOnSelect}
            minZoom={minZoom}
            maxZoom={maxZoom}
            nodeExtent={nodeExtent}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            snapToGrid={snapToGrid}
            snapGrid={snapGrid}
            connectionMode={connectionMode}
            translateExtent={translateExtent}
            connectOnClick={connectOnClick}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView={fitView}
            fitViewOptions={fitViewOptions}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onSelectionDrag={onSelectionDrag}
            onSelectionDragStart={onSelectionDragStart}
            onSelectionDragStop={onSelectionDragStop}
            noPanClassName={noPanClassName}
            nodeOrigin={nodeOrigin}
            rfId={rfId}
            autoPanOnConnect={autoPanOnConnect}
            autoPanOnNodeDrag={autoPanOnNodeDrag}
            onError={onError}
            connectionRadius={connectionRadius}
            isValidConnection={isValidConnection}
            nodeDragThreshold={nodeDragThreshold}
          />
          <SelectionListener onSelectionChange={onSelectionChange} />
          {children}
          <A11yDescriptions rfId={rfId} disableKeyboardA11y={disableKeyboardA11y} />
        </Wrapper>
      </div>
    );
  }
);

ReactFlow.displayName = 'kl-reactflow';

export default ReactFlow;
