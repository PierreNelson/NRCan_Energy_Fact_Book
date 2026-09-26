import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min/plotly.min.js';

if (typeof window !== 'undefined') {
  window.Plotly = Plotly;
}

export default createPlotlyComponent(Plotly);
