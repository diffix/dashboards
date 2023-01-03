import { InputNumber } from 'antd';
import { find } from 'lodash';
import React, { FunctionComponent } from 'react';
import { useT } from '../../shared-react';
import { ColumnType } from '../../types';
import { ColumnReference, GeneralizationState } from '../types';
import { CommonProps } from './utils';

import './styles.css';

// Values lower than this will cause the anonymizer to crash.
const MIN_BIN_SIZE_REAL = 0.000001;
const MIN_BIN_SIZE_INTEGER = 1;

function minBinSize(columnType: ColumnType) {
  return columnType === 'real' ? MIN_BIN_SIZE_REAL : MIN_BIN_SIZE_INTEGER;
}

export type GeneralizationControlsProps = CommonProps & { columnName: ColumnReference };

export const GeneralizationControls: FunctionComponent<GeneralizationControlsProps> = ({
  query,
  updateQuery,
  columnName,
}) => {
  const t = useT('QueryBuilder::ColumnSelector::GeneralizationControls');

  function updateColumn(values: Partial<GeneralizationState>) {
    updateQuery((query) => {
      const column = find(query.columns, { name: columnName });
      if (column) {
        Object.assign(column.generalization, values);
      } else {
        console.warn(`Column '${columnName}' not found.`);
      }
    });
  }

  const column = find(query.columns, { name: columnName });
  if (!column) {
    return null; // Should not happen.
  }

  const { generalization } = column;

  switch (column.type) {
    case 'integer':
    case 'real': {
      const minValue = minBinSize(column.type);
      const isValid = generalization.binSize !== null && generalization.binSize >= minValue;
      return (
        <div className={'GeneralizationControls' + (isValid ? ' valid' : '')}>
          <div className="GeneralizationControls-input-row">
            <span className="GeneralizationControls-label">{t('Bin size')}</span>
            <InputNumber
              size="small"
              min={minValue}
              value={generalization.binSize as number}
              onChange={(binSize) => updateColumn({ binSize })}
            />
          </div>
        </div>
      );
    }
    case 'text': {
      const isValid = generalization.substringLength !== null;
      return (
        <div className={'GeneralizationControls' + (isValid ? ' valid' : '')}>
          <div className="GeneralizationControls-input-row">
            <span className="GeneralizationControls-label">{t('Substring start')}</span>
            <InputNumber
              // `precision` and `Math.round` in change handler both needed to protect from decimals
              precision={0}
              size="small"
              placeholder="1"
              min={1}
              value={generalization.substringStart as number}
              onChange={(substringStart) => updateColumn({ substringStart: Math.round(substringStart) })}
            />
          </div>
          <div className="GeneralizationControls-input-row">
            <span className="GeneralizationControls-label">{t('Substring length')}</span>
            <InputNumber
              // `precision` and `Math.round` in change handler both needed to protect from decimals
              precision={0}
              size="small"
              min={1}
              value={generalization.substringLength as number}
              onChange={(substringLength) => updateColumn({ substringLength: Math.round(substringLength) })}
            />
          </div>
        </div>
      );
    }
    default:
      return null;
  }
};
