import React, { Component, PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import assign from 'lodash/assign';

import Input from 'input';
import Popover from 'popover';
import getWidth from 'utils/getWidth';
import { I18nReciever as Reciever } from 'i18n';
import { TimePicker as I18nDefault } from 'i18n/default';

import DatePanel from './date/DatePanel';
import PanelFooter from './common/PanelFooter';
import {
  CURRENT_DAY,
  goMonths,
  setSameDate,
  formatDate,
  parseDate
} from './utils';
import { dayStart, dayEnd, setTime } from './utils/date';
import {
  timeFnMap,
  noop,
  popPositionMap,
  commonProps,
  commonPropTypes
} from './constants/';

function extractStateFromProps(props) {
  let selected;
  let actived;
  let showPlaceholder;
  const { openPanel, value, format, defaultValue, defaultTime } = props;

  if (value) {
    const tmp = parseDate(value, format);

    if (tmp) {
      showPlaceholder = false;
      selected = tmp;
      actived = setTime(tmp);
    } else {
      console.warn("date and format don't match."); // eslint-disable-line
      showPlaceholder = true;
      actived = dayStart();
    }
  } else {
    showPlaceholder = true;

    /**
     * 当前面板显示优先级：
     * defalutValue > currentDay
     */

    if (defaultValue) {
      actived = parseDate(defaultValue, format);
    } else {
      actived = dayStart();
    }

    actived = parseDate(actived, format);
  }

  if (defaultTime) {
    actived = setTime(actived, defaultTime);
  }
  /**
   * actived 用来临时存放日期，改变年份和月份的时候只会改动 actived 的值
   * selected 用来存放用户选择的日期，点击日期时会设置 selected 的值
   * activedTime 用来存放用户选择的时间
   */

  return {
    value: selected && formatDate(selected, format),
    actived,
    selected,
    activedTime: selected || actived,
    openPanel,
    showPlaceholder
  };
}

class DatePicker extends (PureComponent || Component) {
  static propTypes = {
    ...commonPropTypes,
    showTime: PropTypes.bool,
    onBeforeConfirm: PropTypes.func,
    onBeforeClear: PropTypes.func
  };

  static defaultProps = {
    ...commonProps,
    placeholder: ''
  };

  retType = 'string';

  constructor(props) {
    super(props);
    const { isFooterVisble, showTime, value, valueType } = props;

    if (valueType) {
      this.retType = valueType.toLowerCase();
    } else if (value) {
      if (typeof value === 'number') this.retType = 'number';
      if (value instanceof Date) this.retType = 'date';
    }

    this.state = extractStateFromProps(props);
    // 没有footer的逻辑
    this.isfooterShow = showTime || isFooterVisble;
  }

  componentWillReceiveProps(next) {
    const state = extractStateFromProps(next);
    this.setState(state);
  }

  getDate = () => {
    return this.state.actived;
  };

  onChangeDate = val => {
    this.setState({
      actived: val
    });
  };

  onSelectDate = val => {
    const { onClick } = this.props;
    const { activedTime } = this.state;
    if (this.isDisabled(val)) return;
    // update activedTime here
    this.setState({
      actived: val,
      selected: val,
      activedTime: setSameDate(activedTime, val)
    });
    onClick && onClick(val);
    if (!this.isfooterShow) {
      this.onConfirm();
    }
  };

  onChangeTime = (val, type) => {
    const fn = timeFnMap[type];
    const tmp = new Date(this.state.activedTime);
    tmp[fn](val);

    this.setState({
      activedTime: tmp
    });
  };

  onChangeMonth = type => {
    const typeMap = {
      prev: -1,
      next: 1
    };

    return () => {
      const { actived } = this.state;
      const acp = goMonths(actived, typeMap[type]);

      this.setState({
        actived: acp
      });
    };
  };

  onClearInput = evt => {
    const { onChange, onBeforeClear } = this.props;
    if (onBeforeClear && !onBeforeClear()) return;

    evt.stopPropagation();
    onChange('');
  };

  /**
   * 如果传入为数字，返回值也为数字
   * 如果传入为 Date 的实例，返回值也为 Date 的实例
   * 默认返回 format 格式的字符串
   */

  getReturnValue(date, format) {
    if (this.retType === 'number') {
      return date.getTime();
    }

    if (this.retType === 'date') {
      return date;
    }

    return formatDate(date, format);
  }

  onConfirm = () => {
    const { selected, activedTime } = this.state;
    const { format, showTime, onClose, onChange, onBeforeConfirm } = this.props;

    if (onBeforeConfirm && !onBeforeConfirm()) return;
    // 如果没有选择日期则默认选中当前日期
    let tmp = selected || dayStart();
    if (this.isDisabled(tmp)) return;

    if (showTime) {
      tmp = new Date(
        tmp.getFullYear(),
        tmp.getMonth(),
        tmp.getDate(),
        activedTime.getHours(),
        activedTime.getMinutes(),
        activedTime.getSeconds()
      );
    }

    this.setState({
      value: formatDate(tmp, format),
      openPanel: false,
      showPlaceholder: false
    });

    const ret = this.getReturnValue(tmp, format);
    onChange(ret);
    onClose && onClose();
  };

  isDisabled = val => {
    const { disabledDate, min, max, format } = this.props;
    if (disabledDate && disabledDate(val)) return true;
    if (min && dayEnd(val) < parseDate(min, format)) return true;
    if (max && dayStart(val) > parseDate(max, format)) return true;

    return false;
  };

  renderPicker(i18n) {
    const {
      props: { confirmText, disabledTime, format, max, min },
      state: { actived, activedTime, openPanel, selected }
    } = this;
    let showTime;
    let datePicker;

    // let isShow
    if (this.props.showTime) {
      showTime = assign(
        {
          min: min && parseDate(min, format),
          max: max && parseDate(max, format),
          actived: activedTime,
          disabledTime: noop
        },
        {
          disabledTime: disabledTime && disabledTime(),
          onChange: this.onChangeTime
        }
      );
    }

    // 打开面板的时候才渲染
    if (openPanel) {
      const isDisabled = this.isDisabled(CURRENT_DAY);
      const linkCls = classNames({
        'link--current': true,
        'link--disabled': isDisabled
      });
      const datePickerCls = classNames({
        'date-picker': true,
        small: this.isfooterShow
      });

      datePicker = (
        <div className={datePickerCls} ref={ref => (this.picker = ref)}>
          <DatePanel
            showTime={showTime}
            actived={actived}
            selected={selected}
            disabledDate={this.isDisabled}
            onSelect={this.onSelectDate}
            onChange={this.onChangeDate}
            onPrev={this.onChangeMonth('prev')}
            onNext={this.onChangeMonth('next')}
            i18n={i18n}
          />
          {this.isfooterShow ? (
            <PanelFooter
              buttonText={confirmText || i18n.confirm}
              onClickButton={this.onConfirm}
              linkText={i18n.current.date}
              linkCls={linkCls}
              showLink={!isDisabled}
              onClickLink={() => this.onSelectDate(CURRENT_DAY)}
            />
          ) : null}
        </div>
      );
    }

    return datePicker;
  }

  togglePicker = () => {
    const { onOpen, onClose, disabled } = this.props;
    const openPanel = !this.state.openPanel;
    if (disabled) return;

    openPanel ? onOpen && onOpen() : onClose && onClose();
    this.setState({
      openPanel
    });
  };

  render() {
    const {
      props: {
        prefix,
        className,
        disabled,
        width,
        popPosition,
        name,
        placeholder
      },
      state: { showPlaceholder, openPanel, value }
    } = this;
    const wrapperCls = `${prefix}-datetime-picker ${className}`;
    const inputCls = classNames({
      'picker-input': true,
      'picker-input--filled': !showPlaceholder,
      'picker-input--disabled': disabled
    });
    const widthStyle = getWidth(width);
    return (
      <div style={widthStyle} className={wrapperCls}>
        <Reciever componentName="TimePicker" defaultI18n={I18nDefault}>
          {i18n => (
            <Popover
              cushion={5}
              visible={openPanel}
              onVisibleChange={this.togglePicker}
              className={`${prefix}-datetime-picker-popover ${className}-popover`}
              position={popPositionMap[popPosition.toLowerCase()]}
            >
              <Popover.Trigger.Click>
                <div
                  style={widthStyle}
                  className={inputCls}
                  onClick={evt => evt.preventDefault()}
                >
                  <Input
                    name={name}
                    value={showPlaceholder ? placeholder || i18n.date : value}
                    onChange={noop}
                    disabled={disabled}
                  />
                  <span className="zenticon zenticon-calendar-o" />
                  <span
                    onClick={this.onClearInput}
                    className="zenticon zenticon-close-circle"
                  />
                </div>
              </Popover.Trigger.Click>
              <Popover.Content>{this.renderPicker(i18n)}</Popover.Content>
            </Popover>
          )}
        </Reciever>
      </div>
    );
  }
}

export default DatePicker;
