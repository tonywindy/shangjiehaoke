import React, { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import './ShizhenPage.css';

/**
 * 时钟夹角学习工具组件
 * 帮助学生通过拖动指针或输入时间来观察时钟夹角
 */
const ShizhenPage = () => {
    const [hours, setHours] = useState(3);
    const [minutes, setMinutes] = useState(0);
    const [showAngle, setShowAngle] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [activeHand, setActiveHand] = useState(null);

    const hourHandRef = useRef(null);
    const minuteHandRef = useRef(null);
    const clockContainerRef = useRef(null);
    const angleArcRef = useRef(null);
    const angleTextRef = useRef(null);

    // Initialize clock face (ticks and numbers)
    useEffect(() => {
        drawFace();
    }, []);

    // Update clock when hours or minutes change
    useEffect(() => {
        updateClock();
    }, [hours, minutes, showAngle]);

    const drawFace = () => {
        const ticksContainer = document.getElementById('ticksContainer');
        const numbersContainer = document.getElementById('numbersContainer');

        if (!ticksContainer || !numbersContainer) return;

        // Clear existing content
        ticksContainer.innerHTML = '';
        numbersContainer.innerHTML = '';

        // Draw ticks
        for (let i = 0; i < 60; i++) {
            const tick = document.createElement('div');
            tick.className = `tick ${i % 5 === 0 ? 'major' : ''}`;
            tick.style.transform = `rotate(${i * 6}deg) translateY(0)`;
            ticksContainer.appendChild(tick);
        }

        // Draw Numbers
        for (let i = 1; i <= 12; i++) {
            const angle = i * 30;
            const rad = (angle - 90) * (Math.PI / 180);
            const distance = 120;
            const x = 150 + distance * Math.cos(rad);
            const y = 150 + distance * Math.sin(rad);

            const num = document.createElement('div');
            num.className = 'clock-number';
            num.textContent = i;
            num.style.left = x + 'px';
            num.style.top = y + 'px';
            numbersContainer.appendChild(num);
        }
    };

    const setTime = (h, m) => {
        if (h > 12) h = h - 12;
        if (h < 1) h = 12;
        if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
        if (m < 0) { m = 0; }

        setHours(h);
        setMinutes(m);
    };

    const updateClock = () => {
        const minuteAngle = minutes * 6;
        const hourAngle = ((hours % 12) * 30) + (minutes * 0.5);

        if (minuteHandRef.current) {
            minuteHandRef.current.style.transform = `rotate(${minuteAngle}deg)`;
        }
        if (hourHandRef.current) {
            hourHandRef.current.style.transform = `rotate(${hourAngle}deg)`;
        }

        updateAngleVisualization(hourAngle, minuteAngle);
    };

    const updateAngleVisualization = (hAngle, mAngle) => {
        let ha = hAngle % 360;
        let ma = mAngle % 360;
        if (ha < 0) ha += 360;
        if (ma < 0) ma += 360;

        let diff = Math.abs(ha - ma);
        if (diff > 180) diff = 360 - diff;

        const displayDiff = Number.isInteger(diff) ? diff : diff.toFixed(1);

        const angleValueElement = document.getElementById('angleValue');
        if (angleValueElement) {
            angleValueElement.textContent = displayDiff;
        }

        if (!showAngle || !angleArcRef.current || !angleTextRef.current) {
            if (angleArcRef.current) angleArcRef.current.style.display = 'none';
            if (angleTextRef.current) angleTextRef.current.style.display = 'none';
            return;
        }

        angleArcRef.current.style.display = 'block';
        angleTextRef.current.style.display = 'block';
        angleTextRef.current.textContent = displayDiff + '°';

        // Draw Arc
        const r = 60;
        const cx = 150;
        const cy = 150;

        let startAngle = Math.min(ha, ma);
        let endAngle = Math.max(ha, ma);

        if (endAngle - startAngle > 180) {
            const temp = startAngle;
            startAngle = endAngle;
            endAngle = temp + 360;
        }

        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (endAngle - 90) * Math.PI / 180;

        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);

        const largeArcFlag = 0;
        const sweepFlag = 1;

        const d = [
            "M", cx, cy,
            "L", x1, y1,
            "A", r, r, 0, largeArcFlag, sweepFlag, x2, y2,
            "Z"
        ].join(" ");

        angleArcRef.current.setAttribute("d", d);

        const midAngle = (startAngle + endAngle) / 2;
        const midRad = (midAngle - 90) * Math.PI / 180;
        const textDist = 90;
        const tx = cx + textDist * Math.cos(midRad);
        const ty = cy + textDist * Math.sin(midRad);

        angleTextRef.current.setAttribute("x", tx);
        angleTextRef.current.setAttribute("y", ty);
    };

    const handleSetTime = () => {
        const h = parseInt(document.getElementById('inputHour').value) || 12;
        const m = parseInt(document.getElementById('inputMinute').value) || 0;
        setTime(h, m);
    };

    const handleRandomTime = () => {
        const h = Math.floor(Math.random() * 12) + 1;
        const m = Math.floor(Math.random() * 60);
        document.getElementById('inputHour').value = h;
        document.getElementById('inputMinute').value = m;
        setTime(h, m);
    };

    const toggleAngleDisplay = () => {
        setShowAngle(!showAngle);
    };

    const startDrag = (e, handType) => {
        e.preventDefault();
        setIsDragging(true);
        setActiveHand(handType);
    };

    const stopDrag = () => {
        setIsDragging(false);
        setActiveHand(null);
    };

    const drag = (e) => {
        if (!isDragging || !clockContainerRef.current) return;
        e.preventDefault();

        const rect = clockContainerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const dx = clientX - centerX;
        const dy = clientY - centerY;

        let rad = Math.atan2(dy, dx);
        let deg = rad * (180 / Math.PI);

        deg = deg + 90;
        if (deg < 0) deg += 360;

        if (activeHand === 'minute') {
            const snappedDeg = Math.round(deg / 6) * 6;
            const newMinutes = Math.round(snappedDeg / 6) % 60;
            setMinutes(newMinutes);
            document.getElementById('inputMinute').value = newMinutes;
        } else if (activeHand === 'hour') {
            const totalHours = deg / 30;
            let h = Math.floor(totalHours);
            if (h === 0) h = 12;
            const remainderFraction = totalHours - Math.floor(totalHours);
            const m = Math.round(remainderFraction * 60);

            setHours(h);
            setMinutes(m);
            document.getElementById('inputHour').value = h;
            document.getElementById('inputMinute').value = m;
        }
    };

    useEffect(() => {
        window.addEventListener('mousemove', drag);
        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('touchmove', drag, { passive: false });
        window.addEventListener('touchend', stopDrag);

        return () => {
            window.removeEventListener('mousemove', drag);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', drag);
            window.removeEventListener('touchend', stopDrag);
        };
    }, [isDragging, activeHand, hours, minutes]);

    return (
        <div className="shizhen-page">
            <Navbar currentPage="works" />

            <div className="shizhen-container">
                <div className="shizhen-content">

                    <header className="shizhen-header">
                        <h1 className="shizhen-title">时钟夹角学习</h1>
                        <p className="shizhen-subtitle">拖动指针或输入时间来观察夹角</p>
                    </header>

                    {/* Clock Container */}
                    <div
                        className="clock-face"
                        id="clockContainer"
                        ref={clockContainerRef}
                    >
                        {/* SVG Layer for Angle Visualization */}
                        <svg className="angle-svg" id="angleSvg" viewBox="0 0 300 300">
                            <path
                                id="angleArc"
                                ref={angleArcRef}
                                d=""
                                fill="rgba(251, 191, 36, 0.3)"
                                stroke="#fbbf24"
                                strokeWidth="2"
                                style={{ display: 'none' }}
                            />
                            <text
                                id="angleTextOnClock"
                                ref={angleTextRef}
                                x="150"
                                y="100"
                                textAnchor="middle"
                                className="angle-text-on-clock"
                                style={{ display: 'none' }}
                            >
                                90°
                            </text>
                        </svg>

                        <div id="ticksContainer"></div>
                        <div id="numbersContainer"></div>

                        {/* Hands */}
                        <div
                            className="hand hour-hand"
                            id="hourHand"
                            ref={hourHandRef}
                            onMouseDown={(e) => startDrag(e, 'hour')}
                            onTouchStart={(e) => startDrag(e, 'hour')}
                        ></div>
                        <div
                            className="hand minute-hand"
                            id="minuteHand"
                            ref={minuteHandRef}
                            onMouseDown={(e) => startDrag(e, 'minute')}
                            onTouchStart={(e) => startDrag(e, 'minute')}
                        ></div>
                        <div className="center-dot"></div>
                    </div>

                    {/* Angle Display */}
                    <div className="angle-display-card">
                        <div className="angle-toggle-row">
                            <span className="angle-toggle-label">显示度数</span>
                            <button
                                id="toggleAngleBtn"
                                onClick={toggleAngleDisplay}
                                className={`toggle-button ${showAngle ? 'active' : ''}`}
                            >
                                <span className={`toggle-knob ${showAngle ? 'active' : ''}`}></span>
                            </button>
                        </div>

                        <div className={`angle-display-area ${showAngle ? 'visible' : ''}`}>
                            <div className="angle-value-display">
                                <span id="angleValue">{
                                    (() => {
                                        const minuteAngle = minutes * 6;
                                        const hourAngle = ((hours % 12) * 30) + (minutes * 0.5);
                                        let ha = hourAngle % 360;
                                        let ma = minuteAngle % 360;
                                        if (ha < 0) ha += 360;
                                        if (ma < 0) ma += 360;
                                        let diff = Math.abs(ha - ma);
                                        if (diff > 180) diff = 360 - diff;
                                        return Number.isInteger(diff) ? diff : diff.toFixed(1);
                                    })()
                                }</span>°
                            </div>
                            <div className="angle-description">时针与分针的夹角</div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="controls-grid">
                        <div className="control-group">
                            <label className="control-label">时 (Hour)</label>
                            <input
                                type="number"
                                id="inputHour"
                                min="1"
                                max="12"
                                step="1"
                                defaultValue={hours}
                                className="control-input"
                                onChange={(e) => {
                                    const h = parseInt(e.target.value) || 12;
                                    const m = parseInt(document.getElementById('inputMinute').value) || 0;
                                    setTime(h, m);
                                }}
                            />
                        </div>
                        <div className="control-group">
                            <label className="control-label">分 (Minute)</label>
                            <input
                                type="number"
                                id="inputMinute"
                                min="0"
                                max="59"
                                step="1"
                                defaultValue={minutes}
                                className="control-input"
                                onChange={(e) => {
                                    const h = parseInt(document.getElementById('inputHour').value) || 12;
                                    const m = parseInt(e.target.value) || 0;
                                    setTime(h, m);
                                }}
                            />
                        </div>
                    </div>

                    <div className="button-row">
                        <button onClick={handleSetTime} className="btn-primary">
                            设定时间
                        </button>
                        <button onClick={handleRandomTime} className="btn-secondary">
                            随机时间
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ShizhenPage;
