/**
 * Dual Downline Animation - Binary Tree Structure
 * Demonstrates pre-building concept with sliding migration animation
 */

class DownlineAnimation {
    constructor() {
        this.leftDownline = null;
        this.rightDownline = null;
        this.animationActive = false;
        this.observer = null;
        this.members = {}; // Store member avatars by ID

        // Avatar emojis (mix of male/female representations)
        this.avatars = ['👨', '👩', '👨‍💼', '👩‍💼', '🧑', '👨‍🦰', '👩‍🦰', '👱‍♂️', '👱‍♀️'];

        this.init();
    }

    init() {
        this.setupObserver();
    }

    setupObserver() {
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.3
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.animationActive) {
                    this.startAnimation();
                }
            });
        }, options);

        const section = document.getElementById('downline-animation-section');
        if (section) {
            this.observer.observe(section);
        }
    }

    getRandomAvatar() {
        return this.avatars[Math.floor(Math.random() * this.avatars.length)];
    }

    createMemberNode(avatar, delay = 0, label = null, memberId = null) {
        const node = document.createElement('div');
        node.className = 'member-node';
        if (memberId) {
            node.setAttribute('data-member-id', memberId);
        }

        if (label) {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'member-label';
            labelDiv.textContent = label;
            node.appendChild(labelDiv);
        }

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'member-avatar';
        avatarDiv.textContent = avatar;

        node.appendChild(avatarDiv);

        setTimeout(() => {
            node.classList.add('visible');
        }, delay);

        return node;
    }

    async startAnimation() {
        this.animationActive = true;
        this.members = {};

        this.leftDownline = document.getElementById('downline-left');
        this.rightDownline = document.getElementById('downline-right');

        if (!this.leftDownline || !this.rightDownline) return;

        // Phase 1: Build left downline (binary tree: 1-2-4)
        await this.buildLeftDownline();

        // Phase 2: Show right downline top member (Sponsor)
        await this.delay(500);
        await this.showRightDownlineTop();

        // Phase 3: Migrate members with sliding animation
        await this.delay(800);
        await this.migrateMembersToRight();

        // Phase 4: Show benefits
        await this.delay(600);
        this.showBenefits();

        // Loop animation
        setTimeout(() => {
            this.resetAnimation();
            setTimeout(() => this.startAnimation(), 1000);
        }, 10000);
    }

    async buildLeftDownline() {
        // Level 0 - Top member (Member 1)
        const level0 = this.leftDownline.querySelector('.downline-level-0');
        const avatar1 = this.getRandomAvatar();
        this.members['1'] = avatar1;
        const member1 = this.createMemberNode(avatar1, 0, null, '1');
        level0.appendChild(member1);

        await this.delay(600);

        // Level 1 - 2 members (Members 2, 3)
        const level1 = this.leftDownline.querySelector('.downline-level-1');

        const avatar2 = this.getRandomAvatar();
        this.members['2'] = avatar2;
        const member2 = this.createMemberNode(avatar2, 100, null, '2');
        level1.appendChild(member2);

        const avatar3 = this.getRandomAvatar();
        this.members['3'] = avatar3;
        const member3 = this.createMemberNode(avatar3, 200, null, '3');
        level1.appendChild(member3);

        await this.delay(600);

        // Level 2 - 4 members (Members 4, 5, 6, 7)
        const level2 = this.leftDownline.querySelector('.downline-level-2');
        const level2Members = [
            { id: '4', delay: 100 },
            { id: '5', delay: 200 },
            { id: '6', delay: 300 },
            { id: '7', delay: 400 }
        ];

        level2Members.forEach(({ id, delay }) => {
            const avatar = this.getRandomAvatar();
            this.members[id] = avatar;
            const member = this.createMemberNode(avatar, delay, null, id);
            level2.appendChild(member);
        });

        await this.delay(800);
    }

    async showRightDownlineTop() {
        // Right downline starts empty - will be built by migrations
        // No initial member needed
        await this.delay(400);
    }

    async migrateMembersToRight() {
        // Migration order: 1, 2, 4, 7, 3, 5, 6
        const migrationOrder = ['1', '2', '4', '7', '3', '5', '6'];

        for (const memberId of migrationOrder) {
            await this.slideMemberToRight(memberId);
            await this.delay(800);
        }
    }

    async slideMemberToRight(memberId) {
        const leftMember = this.leftDownline.querySelector(`[data-member-id="${memberId}"]`);
        if (!leftMember) return;

        const avatar = this.members[memberId];
        if (!avatar) return;

        // Get positions
        const leftRect = leftMember.getBoundingClientRect();

        // Create sliding clone
        const clone = document.createElement('div');
        clone.className = 'member-avatar sliding-clone';
        clone.textContent = avatar;
        clone.style.cssText = `
            left: ${leftRect.left}px;
            top: ${leftRect.top}px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            border: 3px solid #667eea;
        `;

        document.body.appendChild(clone);

        // Calculate slide distance (approximate - will be visible slide to right side)
        const slideDistance = window.innerWidth > 968 ? 600 : 400;
        clone.style.setProperty('--slide-distance', `${slideDistance}px`);

        // Fade out original
        leftMember.style.opacity = '0.3';

        // Wait for slide animation
        await this.delay(1200);

        // Remove clone
        clone.remove();

        // Add to right downline
        this.addToRightDownline(memberId, avatar);

        await this.delay(200);
    }

    addToRightDownline(memberId, avatar) {
        const rightLevel0 = this.rightDownline.querySelector('.downline-level-0');
        const rightLevel1 = this.rightDownline.querySelector('.downline-level-1');
        const rightLevel2 = this.rightDownline.querySelector('.downline-level-2');

        let targetLevel;

        // Mirror the left downline structure
        // Member 1 goes to Level 0 (top)
        if (memberId === '1') {
            targetLevel = rightLevel0;
        }
        // Members 2, 3 go to Level 1
        else if (memberId === '2' || memberId === '3') {
            targetLevel = rightLevel1;
        }
        // Members 4, 5, 6, 7 go to Level 2
        else {
            targetLevel = rightLevel2;
        }

        const newMember = this.createMemberNode(avatar, 0, null, `R-${memberId}`);
        targetLevel.appendChild(newMember);
    }

    showBenefits() {
        const leftBenefit = document.getElementById('left-benefit');
        if (leftBenefit) {
            setTimeout(() => leftBenefit.classList.add('visible'), 200);
        }

        const rightBenefit = document.getElementById('right-benefit');
        if (rightBenefit) {
            setTimeout(() => rightBenefit.classList.add('visible'), 600);
        }
    }

    resetAnimation() {
        // Clear left downline
        const leftLevels = this.leftDownline.querySelectorAll('.downline-level');
        leftLevels.forEach(level => {
            level.innerHTML = '';
        });

        // Clear right downline
        const rightLevels = this.rightDownline.querySelectorAll('.downline-level');
        rightLevels.forEach(level => {
            level.innerHTML = '';
        });

        // Hide benefits
        const benefits = document.querySelectorAll('.benefit-callout');
        benefits.forEach(benefit => benefit.classList.remove('visible'));

        // Clear members
        this.members = {};

        this.animationActive = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize animation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new DownlineAnimation();
    });
} else {
    new DownlineAnimation();
}
