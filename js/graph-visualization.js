/**
 * KNOWLEDGE GRAPH VISUALIZATION
 *
 * Interactive graph visualization using vis-network.
 * Shows entities as nodes, relationships as edges.
 *
 * Usage:
 *   const graph = new KnowledgeGraphViz('container-id');
 *   await graph.load();
 *
 * Dependencies:
 *   Add to HTML: <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
 *
 * @module js/graph-visualization
 */

class KnowledgeGraphViz {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.network = null;
    this.data = null;
    this.options = {
      height: options.height || '500px',
      showLabels: options.showLabels !== false,
      physics: options.physics !== false,
      ...options
    };

    // Callbacks
    this.onNodeClick = options.onNodeClick || null;
    this.onNodeHover = options.onNodeHover || null;

    if (!this.container) {
      console.error('[GRAPH-VIZ] Container not found:', containerId);
    }
  }

  /**
   * Load graph data from API and render
   * @param {string} filter - Entity type filter (optional)
   */
  async load(filter = 'all') {
    if (!this.container) return;

    this.container.innerHTML = '<div class="graph-loading">Loading your knowledge graph...</div>';

    try {
      const token = await this.getToken();
      const response = await fetch(`/api/graph-data?filter=${filter}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load graph data');
      }

      this.data = await response.json();
      this.render();

      return this.data.meta;

    } catch (error) {
      console.error('[GRAPH-VIZ] Load error:', error);
      this.container.innerHTML = `<div class="graph-error">Unable to load knowledge graph</div>`;
      return null;
    }
  }

  /**
   * Render the graph using vis-network
   */
  render() {
    if (!this.data || !this.container) return;

    // Check if vis is loaded
    if (typeof vis === 'undefined') {
      console.error('[GRAPH-VIZ] vis-network not loaded. Add the script to your HTML.');
      this.container.innerHTML = '<div class="graph-error">Graph library not loaded</div>';
      return;
    }

    // Clear container
    this.container.innerHTML = '';

    // Create nodes DataSet
    const nodes = new vis.DataSet(
      this.data.nodes.map(node => ({
        id: node.id,
        label: this.options.showLabels ? node.label : '',
        title: this.buildNodeTooltip(node),
        size: node.size,
        color: {
          background: node.color,
          border: this.darkenColor(node.color, 20),
          highlight: {
            background: this.lightenColor(node.color, 20),
            border: node.color
          },
          hover: {
            background: this.lightenColor(node.color, 10),
            border: node.color
          }
        },
        font: {
          size: 12,
          color: '#333',
          face: 'Inter, system-ui, sans-serif'
        },
        // Store original data
        originalData: node
      }))
    );

    // Create edges DataSet
    const edges = new vis.DataSet(
      this.data.edges.map((edge, index) => ({
        id: edge.id || `edge-${index}`,
        from: edge.source,
        to: edge.target,
        title: edge.label || edge.type,
        width: Math.max(1, Math.min(5, edge.weight)),
        color: {
          color: edge.isBehavior ? '#FFD700' : '#999',
          opacity: 0.6,
          highlight: edge.isBehavior ? '#FFD700' : '#666',
          hover: edge.isBehavior ? '#FFD700' : '#666'
        },
        arrows: edge.isBehavior ? { to: { enabled: true, scaleFactor: 0.5 } } : {},
        smooth: {
          type: 'continuous'
        },
        // Store original data
        originalData: edge
      }))
    );

    // Network options
    const options = {
      nodes: {
        shape: 'dot',
        scaling: {
          min: 10,
          max: 50
        },
        font: {
          size: 12,
          face: 'Inter, system-ui, sans-serif'
        },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        smooth: {
          type: 'continuous',
          roundness: 0.5
        },
        scaling: {
          min: 1,
          max: 5
        }
      },
      physics: this.options.physics ? {
        enabled: true,
        stabilization: {
          enabled: true,
          iterations: 100,
          updateInterval: 25
        },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.09
        }
      } : {
        enabled: false
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: true,
        hideEdgesOnZoom: true
      },
      layout: {
        improvedLayout: true,
        randomSeed: 42
      }
    };

    // Create network
    this.network = new vis.Network(
      this.container,
      { nodes, edges },
      options
    );

    // Set up event handlers
    this.setupEventHandlers(nodes);

    console.log('[GRAPH-VIZ] Rendered:', {
      nodes: this.data.nodes.length,
      edges: this.data.edges.length
    });
  }

  /**
   * Set up network event handlers
   */
  setupEventHandlers(nodes) {
    if (!this.network) return;

    // Click handler
    this.network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId);

        if (this.onNodeClick && node.originalData) {
          this.onNodeClick(node.originalData);
        }
      }
    });

    // Hover handler
    this.network.on('hoverNode', (params) => {
      const nodeId = params.node;
      const node = nodes.get(nodeId);

      if (this.onNodeHover && node.originalData) {
        this.onNodeHover(node.originalData);
      }
    });

    // Stabilization complete
    this.network.once('stabilizationIterationsDone', () => {
      this.network.setOptions({ physics: { enabled: false } });
    });
  }

  /**
   * Build tooltip content for a node
   */
  buildNodeTooltip(node) {
    let html = `<div class="graph-tooltip">`;
    html += `<strong>${node.label}</strong>`;

    if (node.type !== 'user') {
      html += `<br><small>${node.type}${node.subtype ? ` (${node.subtype})` : ''}</small>`;

      if (node.mentions > 0) {
        html += `<br>Mentioned ${node.mentions}x`;
      }

      if (node.facts && node.facts.length > 0) {
        html += '<br><br><em>Facts:</em>';
        for (const fact of node.facts.slice(0, 3)) {
          html += `<br>• ${fact.predicate}: ${fact.value}`;
        }
      }
    }

    html += '</div>';
    return html;
  }

  /**
   * Filter graph by entity type
   */
  async filter(type) {
    return this.load(type);
  }

  /**
   * Focus on a specific node
   */
  focusNode(nodeId) {
    if (!this.network) return;

    this.network.focus(nodeId, {
      scale: 1.5,
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad'
      }
    });

    this.network.selectNodes([nodeId]);
  }

  /**
   * Reset view to show all nodes
   */
  resetView() {
    if (!this.network) return;

    this.network.fit({
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad'
      }
    });
  }

  /**
   * Get token for API calls
   */
  async getToken() {
    // Try to get from Sync module if available
    if (typeof Sync !== 'undefined' && Sync.getToken) {
      return Sync.getToken();
    }

    // Try to get from supabase if available
    if (typeof supabase !== 'undefined') {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token;
    }

    console.error('[GRAPH-VIZ] No auth token available');
    return null;
  }

  /**
   * Darken a hex color
   */
  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  /**
   * Lighten a hex color
   */
  lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  /**
   * Destroy the network instance
   */
  destroy() {
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KnowledgeGraphViz;
}

// Make available globally
window.KnowledgeGraphViz = KnowledgeGraphViz;
